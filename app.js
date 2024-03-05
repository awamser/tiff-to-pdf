"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const chokidar_1 = __importDefault(require("chokidar"));
const sharp_1 = __importDefault(require("sharp"));
const pdf_lib_1 = require("pdf-lib");
const fs_1 = require("fs");
const path_1 = require("path");
const app = (0, express_1.default)();
const port = 3000; // Port for the server
const uploadDir = (0, path_1.join)(__dirname, "upload");
const processedDir = (0, path_1.join)(__dirname, "processed");
// Ensure the "uploads" and "processed" directories exist
if (!(0, fs_1.existsSync)(uploadDir)) {
    (0, fs_1.mkdirSync)(uploadDir, { recursive: true });
}
if (!(0, fs_1.existsSync)(processedDir)) {
    (0, fs_1.mkdirSync)(processedDir, { recursive: true });
}
const sanitizeFileName = (fileName) => {
    // Remove the file extension
    const nameWithoutExtension = fileName.replace(/\.[^/.]+$/, "");
    // Remove special characters like commas and spaces, then replace with hyphen
    return nameWithoutExtension.replace(/[, ]+/g, "-");
};
const convertAndMoveFile = (path) => __awaiter(void 0, void 0, void 0, function* () {
    console.log(`path: ${path}`);
    let imageName = (0, path_1.basename)(path, ".tiff") || (0, path_1.basename)(path, ".tif");
    console.log(`path: ${imageName}`);
    imageName = sanitizeFileName(imageName); // Sanitize the file name
    const outputPdfPath = (0, path_1.join)(processedDir, `${imageName}.pdf`);
    const processedTiffPath = (0, path_1.join)(processedDir, `${imageName}${(0, path_1.basename)(path).endsWith(".tiff") ? ".tiff" : ".tif"}`);
    try {
        // Create a new PDF document
        const pdfDoc = yield pdf_lib_1.PDFDocument.create();
        // Determine the number of pages in the multipage TIFF
        const metadata = yield (0, sharp_1.default)(path).metadata();
        const pageCount = metadata.pages || 1; // Assume at least one page
        // Process each page of the multipage TIFF
        for (let i = 0; i < pageCount; i++) {
            const imgBuffer = yield (0, sharp_1.default)(path, { page: i })
                .toFormat("png")
                .toBuffer();
            const img = yield pdfDoc.embedPng(imgBuffer);
            const page = pdfDoc.addPage([img.width, img.height]);
            page.drawImage(img, { x: 0, y: 0, width: img.width, height: img.height });
        }
        // Save the PDF to the processed directory
        const pdfBytes = yield pdfDoc.save();
        yield fs_1.promises.writeFile(outputPdfPath, pdfBytes);
        console.log(`Created PDF ${outputPdfPath}`);
        // Move the original TIFF file to the processed directory, ensuring filename is sanitized
        yield fs_1.promises.rename(path, processedTiffPath);
        console.log(`Moved ${path} to ${processedTiffPath}`);
    }
    catch (error) {
        console.error(`Error processing ${path}: `, error);
    }
});
// Monitor the uploads directory for new TIFF files
chokidar_1.default
    .watch(`${uploadDir}/*.tif?(f)`, { persistent: true })
    .on("add", (path) => {
    console.log(`File ${path} has been added.`);
    convertAndMoveFile(path);
});
app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
    console.log(`Monitoring ${uploadDir} for new uploads...`);
});
