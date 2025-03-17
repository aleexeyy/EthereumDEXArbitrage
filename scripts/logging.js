
const chalk =  require('chalk');

const logWarn = (...args) => {
  console.log(chalk.hex("#FFA500")(...args));
};

const logSuccess = (...args) => {
  console.log(chalk.green(...args));
};

const logInfo = (...args) => {
  console.log(chalk.yellow(...args));
};

const logError = (...args) => {
  console.log(chalk.red(...args));
};

const logTrace = (...args) => {
  console.log(chalk.grey(...args));
};

const logDebug = (...args) => {
  console.log(chalk.magenta(...args));
};

const logFatal = (...args) => {
  console.log(chalk.redBright(...args));
};

module.exports = {
  logDebug,
  logError,
  logFatal,
  logInfo,
  logSuccess,
  logTrace,
}