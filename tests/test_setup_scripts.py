"""Isolated behavior tests: no real installs, containers or databases."""
import os
from pathlib import Path
import shutil
import subprocess
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[1]

class SetupScripts(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.repo = Path(self.tmp.name) / 'repo'
        self.repo.mkdir()
        for name in ('init.sh', 'run.sh', '.env.example', 'docker-compose.yml'):
            shutil.copy2(ROOT / name, self.repo / name)
        self.bin = Path(self.tmp.name) / 'bin'
        self.bin.mkdir()
        self.log = Path(self.tmp.name) / 'calls'
        self.env = {**os.environ, 'PATH': str(self.bin) + ':' + os.environ['PATH'],
                    'CALL_LOG': str(self.log)}
        self.stub('node', 'echo v20.0.0')
        self.stub('npm', 'echo "npm $*" >> "$CALL_LOG"\n[ "${FAIL_INSTALL:-0}" != 1 ] || [ "$1" != install ]')
        self.stub('docker', 'echo "docker $*" >> "$CALL_LOG"\n[ "$*" != "compose exec -T redis redis-cli ping" ] || echo PONG')
        self.stub('sleep', ':')

    def stub(self, name, body):
        p = self.bin / name
        p.write_text('#!/bin/bash\n' + body + '\n')
        p.chmod(0o755)

    def init(self, *args):
        return subprocess.run(['bash', str(self.repo / 'init.sh'), *args],
                              cwd=self.tmp.name, env=self.env,
                              capture_output=True, text=True, timeout=10)

    def test_offline_is_strict_and_key_is_valid(self):
        result = self.init('--docker', '--offline')
        self.assertEqual(result.returncode, 0, result.stderr)
        calls = self.log.read_text()
        self.assertIn('npm install --offline --prefer-offline', calls)
        self.assertIn('docker compose up -d --pull never', calls)
        self.assertIn('npm run db:push', calls)
        key = next(x.split('=', 1)[1] for x in (self.repo / '.env').read_text().splitlines()
                   if x.startswith('SSH_ENCRYPTION_KEY='))
        self.assertEqual(len(bytes.fromhex(key)), 32)

    def test_missing_offline_cache_does_not_retry_online(self):
        self.env['FAIL_INSTALL'] = '1'
        result = self.init('--docker', '--offline')
        self.assertNotEqual(result.returncode, 0)
        calls = self.log.read_text()
        self.assertEqual(sum(x.startswith('npm install') for x in calls.splitlines()), 1)
        self.assertNotIn('compose up', calls)
        self.assertFalse((self.repo / '.env').exists())

    def test_existing_migrations_use_migrate(self):
        meta = self.repo / 'drizzle' / 'meta'
        meta.mkdir(parents=True)
        (meta / '_journal.json').write_text('{}')
        result = self.init('--docker')
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertIn('npm run db:migrate', self.log.read_text())
        self.assertNotIn('npm run db:push', self.log.read_text())

    def test_run_starts_partial_docker_stack(self):
        (self.repo / '.env').write_text('NODE_ENV=development\n')
        self.stub('tmux', 'echo "tmux $*" >> "$CALL_LOG"\n[ "$1" != has-session ]')
        result = subprocess.run(['bash', str(self.repo / 'run.sh'), '--docker', '--tmux'],
                                cwd=self.tmp.name, env=self.env, capture_output=True, text=True, timeout=10)
        self.assertEqual(result.returncode, 0, result.stderr)
        calls = self.log.read_text()
        self.assertIn('docker compose up -d', calls)
        self.assertIn('-c ' + str(self.repo), calls)

    def test_foreground_exit_cleans_up_workers(self):
        (self.repo / '.env').write_text('NODE_ENV=development\n')
        local = self.repo / 'node_modules' / '.bin'
        local.mkdir(parents=True)
        tsx = local / 'tsx'
        tsx.write_text('#!/bin/bash\necho "$BASHPID" >> "$CALL_LOG"\nexec /bin/sleep 60\n')
        tsx.chmod(0o755)
        nxt = local / 'next'
        nxt.write_text('#!/bin/bash\n/bin/sleep 0.1\nexit 7\n')
        nxt.chmod(0o755)
        result = subprocess.run(['bash', str(self.repo / 'run.sh'), '--no-docker', '--no-tmux'],
                                env=self.env, capture_output=True, text=True, timeout=5)
        self.assertEqual(result.returncode, 7)
        for pid in self.log.read_text().splitlines():
            with self.assertRaises(ProcessLookupError):
                os.kill(int(pid), 0)

if __name__ == '__main__':
    unittest.main()
