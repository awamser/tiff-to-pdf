import express from "express";
import chokidar from "chokidar";
import sharp from "sharp";
import { PDFDocument } from "pdf-lib";
import { promises as fs, existsSync, mkdirSync } from "fs";
import { basename, join } from "path";

const app = express();
const port = 3000; // Port for the server

const uploadDir = join(__dirname, "upload");
const processedDir = join(__dirname, "processed");

// Ensure the "upload" and "processed" directories exist
if (!existsSync(uploadDir)) {
  mkdirSync(uploadDir, { recursive: true });
}

if (!existsSync(processedDir)) {
  mkdirSync(processedDir, { recursive: true });
}

const sanitizeFileName = (fileName: string) => {
  // Remove the file extension
  const nameWithoutExtension = fileName.replace(/\.[^/.]+$/, "");
  // Remove special characters like commas and spaces, then replace with hyphen
  return nameWithoutExtension.replace(/[, ]+/g, "-");
};

const convertAndMoveFile = async (path: string) => {
  console.log(`path: ${path}`);
  let imageName = basename(path, ".tiff") || basename(path, ".tif");
  console.log(`path: ${imageName}`);
  imageName = sanitizeFileName(imageName); // Sanitize the file name
  const outputPdfPath = join(processedDir, `${imageName}.pdf`);
  const processedTiffPath = join(
    processedDir,
    `${imageName}${basename(path).endsWith(".tiff") ? ".tiff" : ".tif"}`,
  );

  try {
    // Create a new PDF document
    const pdfDoc = await PDFDocument.create();

    // Determine the number of pages in the multipage TIFF
    const metadata = await sharp(path).metadata();
    const pageCount = metadata.pages || 1; // Assume at least one page

    // Process each page of the multipage TIFF
    for (let i = 0; i < pageCount; i++) {
      const imgBuffer = await sharp(path, { page: i })
        .toFormat("png")
        .toBuffer();
      const img = await pdfDoc.embedPng(imgBuffer);
      const page = pdfDoc.addPage([img.width, img.height]);
      page.drawImage(img, { x: 0, y: 0, width: img.width, height: img.height });
    }

    // Save the PDF to the processed directory
    const pdfBytes = await pdfDoc.save();
    await fs.writeFile(outputPdfPath, pdfBytes);
    console.log(`Created PDF ${outputPdfPath}`);

    // Move the original TIFF file to the processed directory, ensuring filename is sanitized
    await fs.rename(path, processedTiffPath);
    console.log(`Moved ${path} to ${processedTiffPath}`);
  } catch (error) {
    console.error(`Error processing ${path}: `, error);
  }
};

// Monitor the uploads directory for new TIFF files
chokidar
  .watch(`${uploadDir}/*.tif?(f)`, { persistent: true })
  .on("add", (path) => {
    console.log(`File ${path} has been added.`);
    convertAndMoveFile(path);
  });

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
  console.log(`Monitoring ${uploadDir} for new uploads...`);
});
