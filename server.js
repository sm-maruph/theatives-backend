require('dotenv').config();
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');
const fs = require('fs');
const authRoutes = require('./routes/auth');
const dashboardRoutes = require('./routes/dashboard');
const dashboardServices = require('./routes/dashboardServices');
const reviewServices = require('./routes/review');
const clientServices = require('./routes/client');
const jobsServices = require('./routes/jobs');
const blogsServices = require('./routes/blogs');
const galleryServices = require('./routes/gallery');
const showcaseServices = require('./routes/showcase');
const memberServices = require('./routes/member');
const projectServices = require('./routes/projects');
const financeServices = require('./routes/finance');

const app = express();
const PORT = process.env.PORT || 5000;

// Serve static files from multiple upload directories
app.use('/asset/image/serviceUpload', express.static(path.join(__dirname, 'src/asset/image/serviceUpload')));
app.use('/asset/image/microserviceUpload', express.static(path.join(__dirname, 'src/asset/image/microserviceUpload')));
app.use('/asset/image/workUpload', express.static(path.join(__dirname, 'src/asset/image/workUpload')));
app.use('/asset/image/careerUpload', express.static(path.join(__dirname, 'src/asset/image/careerUpload')));
app.use('/asset/image/reviewUpload', express.static(path.join(__dirname, 'src/asset/image/reviewUpload')));
app.use('/asset/image/clientUpload', express.static(path.join(__dirname, 'src/asset/image/clientUpload')));
app.use('/asset/image/jobsUpload', express.static(path.join(__dirname, 'src/asset/image/jobsUpload')));
app.use('/asset/image/blogsUpload', express.static(path.join(__dirname, 'src/asset/image/blogsUpload')));
app.use('/asset/image/galleryUpload', express.static(path.join(__dirname, 'src/asset/image/galleryUpload')));
app.use('/asset/image/showcaseUpload', express.static(path.join(__dirname, 'src/asset/image/showcaseUpload')));
app.use('/asset/image/memberUpload', express.static(path.join(__dirname, 'src/asset/image/memberUpload')));
app.use(cors());
app.use(bodyParser.json());



// Base route
app.get('/', (req, res) => {
  res.send('API is running...');
});

app.get('/api/health', async (req, res) => {
  try {
    await require('./config/db').query('SELECT 1 AS connected');
    res.json({ status: 'ok', database: 'connected' });
  } catch (error) {
    console.error('Health check database failure:', error.message);
    res.status(503).json({ status: 'error', database: 'disconnected' });
  }
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/admin', dashboardRoutes); 
app.use('/api/admin/dashboard', dashboardServices);
app.use('/api/admin/dashboard', projectServices);
app.use('/api/admin/dashboard/finance', financeServices);
app.use('/api/admin/dashboardservices', reviewServices);
app.use('/api/admin/dashboardservices', clientServices);
app.use('/api/admin/dashboardservices', jobsServices);
app.use('/api/admin/dashboardservices', blogsServices);
app.use('/api/admin/dashboardservices', galleryServices);
app.use('/api/admin/dashboardservices', showcaseServices);
app.use('/api/admin/dashboardservices', memberServices);





// Server start (keep this at the bottom)
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
