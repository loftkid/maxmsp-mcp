autowatch = 1;

const Max = require("max-api");
const http = require("http");
const { Server } = require("socket.io");

// Configuration
var PORT = 5002;
const HOST = "127.0.0.1"; // local only: anyone who can reach this port can edit open patches
const NAMESPACE = "/mcp";

var io = null;
var http_server = null;

function safe_parse_json(str) {
    try {
        return JSON.parse(str);
    } catch (e) {
        Max.post("error, Invalid JSON: " + e.message);
        Max.post("This is likely because the patcher has too much objects, select some of them and try again");
        return null;
    }
}

// browsers always send an Origin header; the python MCP client does not
function allow_request(req, callback) {
  callback(null, !req.headers.origin);
}

async function start_server() {
  if (io) {
    await io.close();
  }
  http_server = http.createServer();
  io = new Server(http_server, { allowRequest: allow_request });

  io.of(NAMESPACE).on("connection", (socket) => {
    Max.post(`Socket.IO client connected: ${socket.id}`);

    socket.on("command", async (data) => {
      Max.outlet("command", JSON.stringify(data));
    });

    socket.on("request", async (data) => {
      // Route requests through same outlet as commands - js handles both
      Max.outlet("command", JSON.stringify(data));
    });

    socket.on("disconnect", () => {
      Max.post(`Socket.IO client disconnected: ${socket.id}`);
    });
  });

  http_server.listen(PORT, HOST);
  await Max.outlet("port", `Server listening on ${HOST}:${PORT}`);
}

Max.addHandler("response", async (...msg) => {
	var str = msg.join("")
	var data = safe_parse_json(str);
	await io.of(NAMESPACE).emit("response", data);
});

Max.addHandler("port", async (msg) => {
  Max.post(`msg ${msg}`);
  if (msg > 0 && msg < 65536) {
    PORT = msg;
  }
  await start_server();
});

start_server();
