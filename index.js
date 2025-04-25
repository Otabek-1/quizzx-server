const express = require("express");
const grpc = require("@grpc/grpc-js");
const protoLoader = require("@grpc/proto-loader");
const cors = require("cors");
const quizzes = require("./quizzes.json"); // quizzes.json faylini import qilish

const app = express();
const corsOptions = {
    origin: 'http://localhost:5173', // Frontend manzilingiz
    methods: 'GET,POST,PUT,DELETE', // Qo'llaniladigan metodlar
    allowedHeaders: 'Content-Type, Authorization', // Ruxsat berilgan header'lar
  };
  
  app.use(cors(corsOptions)); // CORS middleware qo'shish
const PORT = 3000; // REST API uchun port

// gRPC yuklash
const packageDef = protoLoader.loadSync("quizz.proto", {});
const grpcObject = grpc.loadPackageDefinition(packageDef);
const quizzPackage = grpcObject.quizzPackage;

const grpcServer = new grpc.Server();
const grpcClient = new quizzPackage.quizzService(
  "127.0.0.1:50051", // gRPC server manzili
  grpc.credentials.createInsecure()
);

// gRPC server'ni ishlatish
grpcServer.addService(quizzPackage.quizzService.service, {
  GetQuizzes: (call) => {
    const selected = new Set();
    while (selected.size < 10) {
      const randomIndex = Math.floor(Math.random() * 50);
      selected.add(quizzes[randomIndex]);
    }
    for (const quiz of selected) {
      call.write(quiz);
    }
    call.end();
  },
  TestResult: (call, callback) => {
    const { name, corrects } = call.request;
    callback(null, {
      name,
      result: corrects,
    });
  },
});

grpcServer.bindAsync("127.0.0.1:50051", grpc.ServerCredentials.createInsecure(), (err, port) => {
  if (err) {
    console.error("gRPC server error: ", err);
    return;
  }
  console.log(`gRPC server running at http://127.0.0.1:${port}`);
});

// REST API uchun route va server yaratish
app.get("/api/quizzes", (req, res) => {
  const quizzes = [];

  const call = grpcClient.GetQuizzes({}, {});

  call.on("data", (quiz) => {
    quizzes.push(quiz);
  });

  call.on("end", () => {
    res.json(quizzes);
  });

  call.on("error", (err) => {
    console.error("gRPC error: ", err);
    res.status(500).json({ error: "gRPC error" });
  });
});

app.post("/api/result", express.json(), (req, res) => {
  const { name, corrects } = req.body;

  grpcClient.TestResult({ name, corrects }, (err, response) => {
    if (err) {
      console.error("gRPC error: ", err);
      return res.status(500).json({ error: "gRPC error" });
    }
    res.json(response);
  });
});

// REST API server'ni ishga tushurish
app.listen(PORT, () => {
  console.log(`REST API server is running at http://localhost:${PORT}`);
});
