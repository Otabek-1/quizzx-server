const express = require("express");
const grpc = require("@grpc/grpc-js");
const protoLoader = require("@grpc/proto-loader");
const cors = require("cors");
const axios = require("axios");
const path = require("path");

const app = express();
const PORT = 3000;
const GRPC_PORT = 50051;

// Quiz ma'lumotlari massivi
const quizzes = [
  {
    id: 1,
    text: "Assassinlar qaysi diniy sekta bilan bog‘liq bo‘lgan?",
    options: ["Sunniylar", "Ismoiliylar", "Xristianlar", "Zardushtiylar"],
    correct: "Ismoiliylar"
  },
  {
    id: 2,
    text: "Assassinlar asoschisi kim edi?",
    options: ["Salohiddin Ayyubiy", "Hasan ibn Sabboh", "Nizam ul-Mulk", "Konrad Monferrat"],
    correct: "Hasan ibn Sabboh"
  },
  {
    id: 3,
    text: "Assassinlar o‘z harakatiga qayerda asos solgan?",
    options: ["Damashq", "Bag‘dod", "Alamut qal’asi", "Misr"],
    correct: "Alamut qal’asi"
  },
  {
    id: 4,
    text: "Assassinlar qanday maqsad bilan suiqasd uyushtirgan?",
    options: ["Boylik orttirish uchun", "Siyosiy ta’sir o‘tkazish uchun", "Shaxsiy qasos uchun", "Savdo yo‘llarini egallash uchun"],
    correct: "Siyosiy ta’sir o‘tkazish uchun"
  },
  {
    id: 5,
    text: "Quyidagilardan qaysi biri Assassinlar tomonidan o‘ldirilgan?",
    options: ["Salohiddin Ayyubiy", "Malik Sanjar", "Nizam ul-Mulk", "Richard Sheryurak"],
    correct: "Nizam ul-Mulk"
  },
  {
    id: 6,
    text: "Konrad Monferrat qaysi voqea natijasida vafot etgan?",
    options: ["Urushda", "Salibchilar o'rtasidagi nizo", "Assassinlar suiqasdi", "Salohiddin bilan duel"],
    correct: "Assassinlar suiqasdi"
  },
  {
    id: 7,
    text: "Assassinlar Salohiddin Ayyubiyga qarshi necha marta suiqasd uyushtirishgan?",
    options: ["1 marta", "2 marta", "3 marta", "4 marta"],
    correct: "2 marta"
  },
  {
    id: 8,
    text: "Salohiddin Assassinlar bilan keyinchalik qanday munosabatda bo‘lgan?",
    options: ["Ularni butunlay yo‘q qilgan", "Ular bilan tinchlik o‘rnatgan", "Ularni o‘z armiyasiga qo‘shgan", "Qochishga majbur qilgan"],
    correct: "Ular bilan tinchlik o‘rnatgan"
  },
  {
    id: 9,
    text: "Assassinlar tarixda qaysi xalq tomonidan yakson qilingan?",
    options: ["Arablar", "Saljuqiylar", "Mo‘g‘ullar", "Salibchilar"],
    correct: "Mo‘g‘ullar"
  },
  {
    id: 10,
    text: "Alamut qal’asi qaysi yilda mo‘g‘ullar tomonidan egallangan?",
    options: ["1219-yil", "1256-yil", "1237-yil", "1245-yil"],
    correct: "1256-yil"
  }
];

// Quiz ma'lumotlarini validatsiya qilish
const validateQuizzes = () => {
  try {
    quizzes.forEach((quiz, index) => {
      if (!quiz.id || !quiz.text || !Array.isArray(quiz.options) || !quiz.correct) {
        throw new Error(`Invalid quiz format at index ${index}`);
      }
    });
    console.log(`Validated ${quizzes.length} quizzes`);
  } catch (error) {
    console.error("Error validating quizzes:", error.message);
    process.exit(1);
  }
};

// Middleware
app.use(cors({ origin: "*" }));
app.use(express.json({ limit: "10mb" })); // JSON body limitni oshirdik
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  next();
});

// gRPC sozlamalari
const packageDef = protoLoader.loadSync(path.join(__dirname, "quizz.proto"), {
  keepCase: true,
  longs: String,
  enums: String,
  defaults: true,
  oneofs: true,
});
const grpcObject = grpc.loadPackageDefinition(packageDef);
const quizzPackage = grpcObject.quizzPackage;

const grpcServer = new grpc.Server();
const grpcClient = new quizzPackage.quizzService(
  `127.0.0.1:${GRPC_PORT}`,
  grpc.credentials.createInsecure()
);

// gRPC xizmatlari
grpcServer.addService(quizzPackage.quizzService.service, {
  GetQuizzes: (call) => {
    try {
      console.log("GetQuizzes called");
      const selected = new Set();
      const maxQuizzes = Math.min(10, quizzes.length);
      if (quizzes.length === 0) {
        throw new Error("No quizzes available");
      }
      while (selected.size < maxQuizzes) {
        const randomIndex = Math.floor(Math.random() * quizzes.length);
        selected.add(quizzes[randomIndex]);
      }
      selected.forEach((quiz) => {
        console.log("Sending quiz:", quiz.id);
        call.write(quiz);
      });
      call.end();
    } catch (error) {
      console.error("Error in GetQuizzes:", error.message);
      call.end();
    }
  },
  TestResult: (call, callback) => {
    try {
      const { name, corrects } = call.request;
      if (!name || typeof corrects !== "number") {
        throw new Error("Invalid name or corrects value");
      }
      callback(null, { name, result: corrects });
    } catch (error) {
      console.error("Error in TestResult:", error.message);
      callback({
        code: grpc.status.INVALID_ARGUMENT,
        message: error.message,
      });
    }
  },
});

// gRPC serverni ishga tushurish
const startGrpcServer = () => {
  grpcServer.bindAsync(
    `127.0.0.1:${GRPC_PORT}`,
    grpc.ServerCredentials.createInsecure(),
    (err, port) => {
      if (err) {
        console.error("gRPC server binding error:", err.message);
        process.exit(1);
      }
      console.log(`gRPC server running at http://127.0.0.1:${port}`);
      grpcServer.start();
    }
  );
};

// REST API endpointlari

// Quiz savollarini olish
app.get("/api/quizzes", async (req, res) => {
  try {
    const quizzes = [];
    const call = grpcClient.GetQuizzes({}, {});

    call.on("data", (quiz) => {
      console.log("Received quiz:", quiz.id);
      quizzes.push(quiz);
    });
    call.on("end", () => {
      console.log(`Returning ${quizzes.length} quizzes`);
      res.json(quizzes);
    });
    call.on("error", (err) => {
      console.error("gRPC error in /api/quizzes:", err.message);
      res.status(500).json({ error: "Failed to fetch quizzes" });
    });
  } catch (error) {
    console.error("Error in /api/quizzes:", error.message);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Test natijasini olish
app.post("/api/result", async (req, res) => {
  try {
    const { name, corrects } = req.body;
    if (!name || typeof corrects !== "number") {
      return res.status(400).json({ error: "Name and corrects are required" });
    }

    grpcClient.TestResult({ name, corrects }, (err, response) => {
      if (err) {
        console.error("gRPC error in /api/result:", err.message);
        return res.status(500).json({ error: "Failed to process result" });
      }
      res.json(response);
    });
  } catch (error) {
    console.error("Error in /api/result:", error.message);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Google Sheets'ga natijani saqlash
app.post("/api/save-result", async (req, res) => {
  try {
    const { name, score } = req.body;
    if (!name || typeof score !== "number") {
      return res.status(400).json({ error: "Name and score are required" });
    }

    await saveToSheets(name, score);
    res.json({ message: "Result saved to Google Sheets" });
  } catch (error) {
    console.error("Error in /api/save-result:", error.message);
    res.status(500).json({ error: "Failed to save result to Google Sheets" });
  }
});

// Google Sheets'ga yozish funksiyasi
const saveToSheets = async (name, score) => {
  const SHEET_URL = "https://sheetdb.io/api/v1/dqe5umll0mduq";
  try {
    const response = await axios.post(
      SHEET_URL,
      { data: { name, score, timestamp: new Date().toISOString() } },
      { headers: { "Content-Type": "application/json" } }
    );
    console.log("Saved to Google Sheets:", response.data);
  } catch (error) {
    console.error("Error saving to Google Sheets:", error.message);
    throw error;
  }
};

// Serverni faol ushlab turish (tekin hosting uchun)
const keepServerAlive = () => {
  setInterval(async () => {
    try {
      const response = await axios.get(`http://localhost:${PORT}/api/quizzes`, {
        timeout: 5000,
      });
      console.log(`Keep-alive: Received ${response.data.length} quizzes`);
    } catch (error) {
      console.error("Keep-alive error:", error.message);
    }
  }, 30000); // Har 30 soniyada
};

// Serverni ishga tushurish
const startServer = async () => {
  try {
    validateQuizzes(); // Quiz ma'lumotlarini tekshirish
    startGrpcServer(); // gRPC serverni ishga tushurish
    keepServerAlive(); // Serverni faol ushlab turish
    app.listen(PORT, () => {
      console.log(`REST API server running at http://localhost:${PORT}`);
    });
  } catch (error) {
    console.error("Failed to start server:", error.message);
    process.exit(1);
  }
};

// Serverni boshlash
startServer();
