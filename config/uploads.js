// config/uploads.js
const multer = require("multer");
const path = require("path");
const fs = require("fs");

const createUploader = (folder) => {
  const uploadPath = path.join(__dirname, `../src/asset/image/${folder}`);

  // Create folder if it doesn't exist
  if (!fs.existsSync(uploadPath)) {
    fs.mkdirSync(uploadPath, { recursive: true });
  }

  const storage = multer.diskStorage({
    destination: (req, file, cb) => {
      cb(null, uploadPath);
    },
    filename: (req, file, cb) => {
      const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
      const ext = path.extname(file.originalname);
      cb(null, file.fieldname + "-" + uniqueSuffix + ext);
    },
  });

  return multer({ storage });
};

module.exports = {
  serviceUpload: createUploader("serviceUpload"),
  microserviceUpload: createUploader("microserviceUpload"),
  workUpload: createUploader("workUpload"),
  careerUpload: createUploader("careerUpload"),
  reviewUpload: createUploader("reviewUpload"),
  clientUpload: createUploader("clientUpload"),
  jobsUpload: createUploader("jobsUpload"),
  blogsUpload: createUploader("blogsUpload"),
  galleryUpload: createUploader("galleryUpload"),
  showcaseUpload: createUploader('showcaseUpload'),
  memberUpload: createUploader('memberUpload'),
};
