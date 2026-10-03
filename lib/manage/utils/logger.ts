import chalk from 'chalk';

export const logger = {
  info: (message: string) => {
    console.log(chalk.blue('ℹ'), message);
  },

  success: (message: string) => {
    console.log(chalk.green('✓'), message);
  },

  error: (message: string) => {
    console.log(chalk.red('✗'), message);
  },

  warn: (message: string) => {
    console.log(chalk.yellow('⚠'), message);
  },

  section: (title: string) => {
    console.log('\n' + chalk.bold.underline(title));
  },

  subsection: (title: string) => {
    console.log('\n' + chalk.bold(title));
  },

  plain: (message: string) => {
    console.log(message);
  },

  dimmed: (message: string) => {
    console.log(chalk.dim(message));
  },
};
