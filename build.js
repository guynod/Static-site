const fs = require('fs').promises;
const path = require('path');
const { marked } = require('marked');

// Helper function to ensure directories exist
async function ensureDir(dirPath) {
    try {
        await fs.mkdir(dirPath, { recursive: true });
    } catch (error) {
        if (error.code !== 'EEXIST') throw error;
    }
}

async function copyFile(src, dest) {
    try {
        await fs.mkdir(path.dirname(dest), { recursive: true });
        await fs.copyFile(src, dest);
        console.log(`Copied: ${src} -> ${dest}`);
    } catch (error) {
        console.error(`Error copying ${src}:`, error);
    }
}

async function copyFileIfExists(src, dest) {
    try {
        await fs.access(src);
        await fs.copyFile(src, dest);
        console.log(`Copied: ${src} -> ${dest}`);
    } catch (error) {
        if (error.code === 'ENOENT') {
            // File doesn't exist, skip silently
            return;
        }
        throw error;
    }
}

function parseFrontMatter(content) {
    const frontMatterRegex = /^---\n([\s\S]*?)\n---\n([\s\S]*)$/;
    const match = content.match(frontMatterRegex);
    
    if (!match) return { content };
    
    const frontMatter = match[1];
    const markdownContent = match[2];
    
    const metadata = {};
    frontMatter.split('\n').forEach(line => {
        const [key, ...values] = line.split(':');
        if (key && values.length) {
            let value = values.join(':').trim();
            // Handle arrays in front matter
            if (value.startsWith('[') && value.endsWith(']')) {
                value = value.slice(1, -1).split(',').map(item => item.trim());
            }
            metadata[key.trim()] = value;
        }
    });
    
    return {
        ...metadata,
        content: markdownContent
    };
}

function formatDate(dateStr) {
    return new Date(dateStr).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });
}

function generateBlogContent(posts) {
    return `<div class="search-view">
        <div class="search-box">
            <input type="text" placeholder="Search posts..." class="search-input">
            <button class="search-button">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M21 21L15 15M17 10C17 13.866 13.866 17 10 17C6.13401 17 3 13.866 3 10C3 6.13401 6.13401 3 10 3C13.866 3 17 6.13401 17 10Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
            </button>
        </div>
        <a href="#" class="view-all">View All Posts</a>
    </div>
    <div class="blog-grid">
        ${posts.map(post => {
            const date = formatDate(post.date);
            return `<article class="blog-post">
                <a href="${post.url}" class="post-image">
                    <img src="/images/placeholder.svg" alt="${post.title}" loading="lazy">
                </a>
                <div class="post-content">
                    <h2 class="post-title">
                        <a href="${post.url}">${post.title}</a>
                    </h2>
                    <p class="post-excerpt">${post.excerpt || ''}</p>
                    <time class="post-meta" datetime="${post.date}">${date}</time>
                </div>
            </article>`;
        }).join('\n        ')}
    </div>`;
}

async function loadTemplate(templatePath) {
    try {
        return await fs.readFile(templatePath, 'utf-8');
    } catch (error) {
        console.error(`Error loading template ${templatePath}:`, error);
        return '';
    }
}

async function processMarkdown(src, dest, template, data = {}) {
    try {
        await fs.mkdir(path.dirname(dest), { recursive: true });
        const content = await fs.readFile(src, 'utf-8');
        const { content: markdownContent, ...metadata } = parseFrontMatter(content);
        
        // Replace blog_content placeholder if it exists
        let processedContent = markdownContent;
        if (data.blog_content) {
            processedContent = markdownContent.replace('{{blog_content}}', data.blog_content);
        }
        
        const html = marked(processedContent);
        const templateContent = await fs.readFile(template || 'src/template.html', 'utf-8');
        
        // Load header and footer templates
        const headerContent = await loadTemplate('src/templates/header.html');
        const footerContent = await loadTemplate('src/templates/footer.html');
        
        // Replace content and templates
        let finalHtml = templateContent
            .replace('{{header}}', headerContent)
            .replace('{{{content}}}', html)
            .replace('{{footer}}', footerContent);
        
        // Replace metadata in template
        Object.entries(metadata).forEach(([key, value]) => {
            if (typeof value === 'string') {
                finalHtml = finalHtml.replace(new RegExp(`{{${key}}}`, 'g'), value);
            }
        });
        
        // Set default title if not provided
        finalHtml = finalHtml.replace(/{{title}}/g, metadata.title || 'Guy Margalith');
        
        await fs.writeFile(dest, finalHtml);
        console.log(`Processed: ${src} -> ${dest}`);
        
        return { ...metadata, html, url: dest.replace('dist', '') };
    } catch (error) {
        console.error(`Error processing ${src}:`, error);
        return null;
    }
}

async function build() {
    try {
        // Create dist directory
        await fs.rm('dist', { recursive: true, force: true });
        await ensureDir('dist');
        await ensureDir('dist/images');
        await ensureDir('dist/css');
        await ensureDir('dist/posts');
        await ensureDir('dist/pages');
        
        // Copy static assets
        await copyFileIfExists('src/images/placeholder.svg', 'dist/images/placeholder.svg');
        await copyFileIfExists('src/css/styles.css', 'dist/css/styles.css');
        await copyFileIfExists('src/index.html', 'dist/index.html');
        
        // Process blog posts
        const blogPosts = [];
        const postsDir = 'src/content/posts';
        const posts = await fs.readdir(postsDir);
        
        for (const post of posts) {
            if (post.endsWith('.md')) {
                const htmlPath = path.join('dist/posts', post.replace('.md', '.html'));
                const postData = await processMarkdown(
                    path.join(postsDir, post),
                    htmlPath,
                    'src/template.html'
                );
                if (postData) {
                    blogPosts.push({
                        ...postData,
                        url: '/posts/' + post.replace('.md', '.html')
                    });
                }
            }
        }
        
        // Sort posts by date
        blogPosts.sort((a, b) => new Date(b.date) - new Date(a.date));
        
        // Generate blog content
        const blogContent = generateBlogContent(blogPosts);
        
        // Process pages
        const pages = await fs.readdir('src/pages');
        for (const page of pages) {
            if (page.endsWith('.md')) {
                const htmlPath = path.join('dist/pages', page.replace('.md', '.html'));
                const pageData = page === 'blog.md' ? { blog_content: blogContent } : {};
                await processMarkdown(
                    path.join('src/pages', page),
                    htmlPath,
                    'src/template.html',
                    pageData
                );
            }
        }
        
        console.log('Build completed successfully!');
    } catch (error) {
        console.error('Build failed:', error);
    }
}

build();