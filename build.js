const fs = require('fs').promises;
const path = require('path');
const { marked } = require('marked');

async function copyFile(src, dest) {
    try {
        await fs.mkdir(path.dirname(dest), { recursive: true });
        await fs.copyFile(src, dest);
        console.log(`Copied: ${src} -> ${dest}`);
    } catch (error) {
        console.error(`Error copying ${src}:`, error);
    }
}

async function processMarkdown(src, dest) {
    try {
        await fs.mkdir(path.dirname(dest), { recursive: true });
        const content = await fs.readFile(src, 'utf-8');
        const html = marked(content);
        const template = await fs.readFile('src/template.html', 'utf-8');
        const finalHtml = template.replace('{{content}}', html);
        await fs.writeFile(dest, finalHtml);
        console.log(`Processed: ${src} -> ${dest}`);
    } catch (error) {
        console.error(`Error processing ${src}:`, error);
    }
}

async function build() {
    // Create dist directory
    await fs.rm('dist', { recursive: true, force: true });
    await fs.mkdir('dist', { recursive: true });

    // Copy static assets
    await copyFile('src/css/styles.css', 'dist/css/styles.css');

    // Process home page
    await processMarkdown('src/pages/home.md', 'dist/index.html');

    // Process markdown files
    const pages = await fs.readdir('src/pages');
    for (const page of pages) {
        if (page.endsWith('.md') && page !== 'home.md') {
            const htmlPath = path.join('dist', 'pages', page.replace('.md', '.html'));
            await processMarkdown(path.join('src/pages', page), htmlPath);
        }
    }

    // Process blog posts
    const posts = await fs.readdir('src/blog');
    for (const post of posts) {
        if (post.endsWith('.md')) {
            const htmlPath = path.join('dist', 'blog', post.replace('.md', '.html'));
            await processMarkdown(path.join('src/blog', post), htmlPath);
        }
    }

    console.log('Build completed!');
}

build().catch(console.error);