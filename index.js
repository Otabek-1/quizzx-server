const express = require("express");
const grpc = require("@grpc/grpc-js");
const protoLoader = require("@grpc/proto-loader");
const cors = require("cors");
const axios = require("axios");
const quizzes = require("./quizzes.json"); // quizzes.json faylini import qilish

const app = express();
app.use(cors());
app.use(express.json()); // JSON body parser
const PORT = 3000;

// gRPC yuklash
const packageDef = protoLoader.loadSync("quizz.proto", {});
const grpcObject = grpc.loadPackageDefinition(packageDef);
const quizzPackage = grpcObject.quizzPackage;

const grpcServer = new grpc.Server();
const grpcClient = new quizzPackage.quizzService(
  "127.0.0.1:50051",
  grpc.credentials.createInsecure()
);

// gRPC server
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
    callback(null, { name, result: corrects });
  },
});

grpcServer.bindAsync("127.0.0.1:50051", grpc.ServerCredentials.createInsecure(), (err, port) => {
  if (err) {
    console.error("gRPC server error: ", err);
    return;
  }
  console.log(`gRPC server running at http://127.0.0.1:${port}`);
});

// REST API

// Quizzes olish
app.get("/api/quizzes", (req, res) => {
  const quizzes = [];
  const call = grpcClient.GetQuizzes({}, {});

  call.on("data", (quiz) => quizzes.push(quiz));
  call.on("end", () => res.json(quizzes));
  call.on("error", (err) => {
    console.error("gRPC error: ", err);
    res.status(500).json({ error: "gRPC error" });
  });
});

// Natijani olish
app.post("/api/result", (req, res) => {
  const { name, corrects } = req.body;
  grpcClient.TestResult({ name, corrects }, (err, response) => {
    if (err) {
      console.error("gRPC error: ", err);
      return res.status(500).json({ error: "gRPC error" });
    }
    res.json(response);
  });
});

// 🆕 Google Sheets ga natijani saqlash
app.post("/api/save-result", async (req, res) => {
  const { name, score } = req.body;

  try {
    await saveToSheets(name, score);
    res.json({ message: "Natija Google Sheets'ga yuborildi!" });
  } catch (error) {
    console.error("Google Sheets error: ", error);
    res.status(500).json({ error: "Sheetsga yuborishda xatolik" });
  }
});

// Google Sheets'ga yozish funksiyasi
async function saveToSheets(name, score) {
  const SHEET_URL = 'https://sheetdb.io/api/v1/dqe5umll0mduq'; // <-- o'zingizni SheetDB URL'ini yozing!

  await axios.post(SHEET_URL, {
    data: {
      name,
      score,
    }
  });
}

// Interval bilan serverga so'rov
setInterval(() => {
  axios.get(`http://localhost:${PORT}/api/quizzes`)
    .then(response => {
      console.log('Quizzes data received:', response.data.length, 'ta savol');
    })
    .catch(error => {
      console.error('Error while fetching quizzes:', error);
    });
}, 50000);

// Serverni ishga tushurish
app.listen(PORT, () => {
  console.log(`REST API server is running at http://localhost:${PORT}`);
});
