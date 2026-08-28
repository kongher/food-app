import { Router } from "express";
import multer from "multer";
import { requireAdmin } from "../lib/auth.js";
import { isCloudinaryConfigured, uploadImageBuffer } from "../lib/cloudinary.js";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (!file.mimetype.startsWith("image/")) {
      cb(new Error("ກະລຸນາເລືອກໄຟລ໌ຮູບ."));
      return;
    }
    cb(null, true);
  },
});

export const uploadsRouter = Router();
uploadsRouter.use("/uploads", requireAdmin);

uploadsRouter.post("/uploads", (req, res, next) => {
  upload.single("file")(req, res, (err: unknown) => {
    if (err) {
      const message = err instanceof Error ? err.message : "ອັບໂຫຼດຮູບບໍ່ສຳເລັດ.";
      res.status(400).json({ error: message });
      return;
    }
    next();
  });
}, async (req, res) => {
  if (!isCloudinaryConfigured()) {
    res.status(500).json({ error: "ຍັງບໍ່ໄດ້ຕັ້ງຄ່າ Cloudinary." });
    return;
  }
  if (!req.file?.buffer) {
    res.status(400).json({ error: "ກະລຸນາເລືອກຮູບ." });
    return;
  }

  try {
    const uploaded = await uploadImageBuffer(req.file.buffer);
    res.status(201).json({ url: uploaded.url });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "ອັບໂຫຼດຮູບບໍ່ສຳເລັດ." });
  }
});
