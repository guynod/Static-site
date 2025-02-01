const express = require('express');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Serve static files from dist directory with directory indexes enabled
app.use(express.static('dist', { 
    extensions: ['html'],
    index: ['index.html']
}));

// Handle /blog route specifically
app.get('/blog', (req, res) => {
    res.redirect('/blog/');
});

app.get('/blog/', (req, res) => {
    res.sendFile(path.join(__dirname, 'dist/blog/index.html'));
});

// For any route not found in static files, try appending .html
app.use((req, res, next) => {
    if (!req.path.endsWith('/') && !path.extname(req.path)) {
        const htmlPath = req.path + '.html';
        res.sendFile(path.join(__dirname, 'dist', htmlPath), err => {
            if (err) next();
        });
    } else {
        next();
    }
});

// Final 404 handler
app.use((req, res) => {
    res.status(404).send('Page not found');
});

app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
    console.log(`Serving content from: ${path.join(__dirname, 'dist')}`);
}); 