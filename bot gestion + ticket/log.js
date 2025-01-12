const { readdir, mkdir, writeFile, createWriteStream } = require('node:fs');
const { join } = require('node:path');



const color = {
    red: '\x1b[31m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    magenta: '\x1b[35m',
    cyan: '\x1b[36m',
    white: '\x1b[37m',
    reset: '\x1b[0m'
}



function timestamp() {
    const date = new Date()
    
    const year = date.getFullYear()
    const month = date.getMonth() + 1
    const day = date.getDate()
    const hour = date.getHours()
    const minute = date.getMinutes()
    const second = date.getSeconds()
    const millisecond = date.getMilliseconds()

    // YYYY-MM-DD HH:MM:SS.mmm
    return `${year}-${month}-${day} ${hour}:${minute}:${second}.${millisecond}`
}

function date() {
    const date = new Date()
    
    const year = date.getFullYear()
    const month = date.getMonth() + 1
    const day = date.getDate()

    // YYYY-MM-DD
    return `${year}-${month}-${day}`
}



async function CreateFormat(bot) {
    return bot ? 
    `[${bot}]` :
    `${color.red}[MANAGER]`;
}

async function info(message, bot) {
    if (!bot) bot = "MANAGER";
    const time = timestamp();
    const format = CreateFormat(bot);
    console.log(`${color.green}[${time}] ${format}${color.green}: ${message}${color.reset}`);
    return await CreateLog(bot, message, 'info'); 
}

async function error(message, bot) {
    if (!bot) bot = "MANAGER";
    const time = timestamp();
    const format = CreateFormat(bot);
    console.log(`${color.red}[${time}] ${format}${color.red}: ${message}${color.reset}`);
    return await CreateLog(bot, message, 'error');
}

async function debug(message, bot) {
    const time = timestamp();
    const format = CreateFormat(bot);
    console.log(`${color.blue}[${time}] ${format}${color.blue}: ${message}${color.reset}`);
    return await CreateLog(bot, message, 'debug');
}

async function success(message, bot) {
    if (!bot) bot = "MANAGER";
    const time = timestamp();
    const format = CreateFormat(bot);
    console.log(`${color.cyan}[${time}] ${format}${color.cyan}: ${message}${color.reset}`);
    return await CreateLog(bot, message, 'success');
}

async function CreateLog(bot, log, type) {

    if (!bot) bot = "MANAGER";

    const _DesktopFolder = readdir(join(__dirname, '../', 'Logs')) || [];
    if (!_DesktopFolder.includes('Logs')) {
        mkdir(join(__dirname, '../Logs'));
    }

    const _LogsFolder = readdir(join(__dirname, '../Logs')) || [];
    if (!_LogsFolder.includes(bot)) {
        mkdir(join(__dirname, '../Logs', bot));
    }

    const _LogFiles = readdir(join(__dirname, '../Logs', bot));
    const today = date();

    if (!_LogFiles.includes(today)) {
        writeFile(join(__dirname, '../Logs', bot, `${today}.log`));
    }

    // Create a write stream to the log file, append the log, and close
    const stream = createWriteStream(join(__dirname, '../Logs', bot, today), { flags: 'a' });
    stream.write(`${timestamp()} [${type.toUpperCase()}] ${log} \r \n`); 
    stream.end();
}


module.exports = {
    CreateLog,

    info,
    error,
    debug,
    success,

    color,

    timestamp,
    date
}