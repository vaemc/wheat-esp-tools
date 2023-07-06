const { spawn } = require("child_process");
const args = process.argv.slice(2);
const cmdProcess = spawn("esptool.exe", [
  "-p",
  args[0],
  "-b",
  args[1],
  "read_flash",
  "0",
  "ALL",
  args[2],
]);
cmdProcess.stdout.on("data", (data) => {
  console.log(data.toString("utf8"));
});
cmdProcess.stderr.on("data", (data) => {
  console.error(data.toString("utf8"));
});
cmdProcess.on("close", (code) => {
  console.log(code.toString("utf8"));
});



// node .\index.js COM12 460800 123.bin