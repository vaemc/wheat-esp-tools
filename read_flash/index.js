const { program } = require("commander");

program
  .command("explorer <open_file>")
  .option("--path <path>")
  .action((str, options) => {
    //node index.js explorer open_file --path D:\2023\ts\vue3\wheat-esp-tools\read_flash\index.js
    const { exec } = require("child_process");
    const path = require("path");
    const command = `explorer.exe /select,"${path.normalize(options.path)}"`;
    exec(command, (err, stdout, stderr) => {
      if (err) {
        console.error(err);
        return;
      }
      console.log(`stdout: ${stdout}`);
      console.error(`stderr: ${stderr}`);
    });
  });

program
  .version("1.0.0")
  .command("esptool <read_flash>")
  .option("--port <port>")
  .option("--path <path>")
  .option("--baud <baud>")
  .action((str, options) => {
    //node index.js esptool read_flash --port COM6 --path D:\2023\ts\vue3\wheat-esp-tools\read_flash\ --baud 460800
    const { port, path, baud } = options;
    const { spawn } = require("child_process");
    const cmdProcess = spawn("esptool.exe", [
      "-p",
      port,
      "-b",
      baud,
      "read_flash",
      "0",
      "ALL",
      path,
    ]);
    cmdProcess.stdout.on("data", (data) => {
      console.error(data.toString("utf8"));
    });
    cmdProcess.stderr.on("data", (data) => {
     // console.error(data.toString("utf8"));
    });
    cmdProcess.on("close", (code) => {
     // console.log(code.toString("utf8"));
    });
  });

program.parse(process.argv);
