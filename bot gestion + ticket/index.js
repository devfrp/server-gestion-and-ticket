const { spawn } = require("node:child_process");
const { readdirSync } = require("node:fs");
const { join } = require("node:path");
const { stdout } = require("node:process");
const log = require("./log.js");

require("net").createServer().listen();

const bots = readdirSync(join(__dirname, "./Bots"));

if (bots.length === 0) {
  console.log("No bots were found - Exiting ...");
  process.exit(0);
}

stdout.write(`Found ${bots.length} bots: ${bots.join(", ")}\r\n`);

const defaultVersion = "19.8.1";
const NodeVerstionOverrides = {
  Frostbite: "18.15.0",
  EasierInviteTracker: "18.15.0",
};

const ChildCache = new Map();

StartBots();
async function StartBots() {
  for (const bot of bots) {
    process.chdir(join(__dirname, "./Bots", bot));

    const nodeVersion = NodeVerstionOverrides[bot] || defaultVersion;
    process.nodeVersion = nodeVersion;

    stdout.write(
      `Starting /Bots/${bot} with Node.js ${log.color.magenta}${nodeVersion}${log.color.reset} ...\r\n`
    );

    try {
      require(join(process.cwd(), "package.json"));
    } catch (error) {
      log.error(
        `/Bots/${bot} does not have a package.json file - Skipping ...`
      );
      log.error(error.stack, bot);
      continue;
    }

    try {
      await Spawn(bot);
    } catch (error) {
      log.error(`Failed to start /Bots/${bot} - Skipping ...`);
      log.error(error.stack, bot);
      continue;
    }
  }
}

async function Spawn(bot) {
  const child = spawn("node", ["."], {
    stdio: "pipe",
    stdout: "pipe",
    stderr: "pipe",
    shell: true,
  });

  ChildCache.set(bot, child);

  child.stdout.on("data", async (data) => {
    // If the data is a buffer, convert it to a string and remove the newline
    if (Buffer.isBuffer(data)) data = data.toString().replace(/\r?\n|\r/g, "");
    return console.log(bot, data.toString());
    /*
        if (data.includes('error')) return await log.error(data, bot);
        if (data.includes('debug')) return await log.debug(data, bot);
        if (data.includes('success')) return await log.success(data, bot);
        await log.info(data, bot);
        */
  });
}

const KillKeywords = ["stop", "kill", "exit", "quit"];

process.stdin.on("data", (data) => {
  if (!KillKeywords.includes(data.toString().trim())) return;
  _CleanExit();
});

function _CleanExit() {
  for (const [bot, child] of ChildCache) {
    console.log(`Killing /Bots/${bot} with PID ${child.pid} ...`);
    child.kill();
  }
  process.exit(0);
}

process.on("exit", _CleanExit);
process.on("SIGINT", _CleanExit); 
process.on("SIGTERM", _CleanExit);
