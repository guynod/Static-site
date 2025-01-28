const express = require('express');
const { marked } = require('marked');
const fs = require('fs').promises;
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Serve static files from src directory
app.use(express.static('src'));

// Function to read and convert markdown to HTML
async function getMarkdownContent(filePath) {
    try {
        const content = await fs.readFile(filePath, 'utf-8');
        return marked(content);
    } catch (error) {
        console.error(`Error reading markdown file: ${filePath}`, error);
        return '<p>Content not found</p>';
    }
}

// Handle markdown content requests
app.get('/content/*', async (req, res) => {
    const requestPath = req.params[0];
    const markdownPath = path.join(__dirname, 'src', 'pages', `${requestPath}.md`);
    
    try {
        const html = await getMarkdownContent(markdownPath);
        res.send(html);
    } catch (error) {
        res.status(404).send('<p>Page not found</p>');
    }
});

// Handle blog posts
app.get('/blog/:post', async (req, res) => {
    const postPath = path.join(__dirname, 'src', 'blog', `${req.params.post}.md`);
    
    try {
        const html = await getMarkdownContent(postPath);
        res.send(html);
    } catch (error) {
        res.status(404).send('<p>Blog post not found</p>');
    }
});

// Serve index.html for all other routes
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'src', 'index.html'));
});

app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
}); 