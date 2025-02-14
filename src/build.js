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

// Helper function to copy directory
async function copyDir(src, dest) {
    try {
        await ensureDir(dest);
        const entries = await fs.readdir(src, { withFileTypes: true });
        
        for (let entry of entries) {
            const srcPath = path.join(src, entry.name);
            const destPath = path.join(dest, entry.name);
            
            if (entry.isDirectory()) {
                await copyDir(srcPath, destPath);
            } else {
                await fs.copyFile(srcPath, destPath);
                console.log(`Copied: ${srcPath} -> ${destPath}`);
            }
        }
    } catch (error) {
        console.error(`Error copying directory ${src}:`, error);
    }
}

function formatDate(dateStr) {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
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

async function parseFrontMatter(content) {
    const frontMatterRegex = /^---\n([\s\S]*?)\n---\n([\s\S]*)$/;
    const match = content.match(frontMatterRegex);
    
    if (!match) return { content };
    
    const frontMatter = match[1];
    const markdownContent = match[2];
    
    const metadata = {};
    frontMatter.split('\n').forEach(line => {
        const [key, ...values] = line.split(':');
        if (key && values.length) {
            metadata[key.trim()] = values.join(':').trim();
        }
    });
    
    return { ...metadata, content: markdownContent };
}

async function processMarkdown(src, dest, template, data = {}) {
    try {
        await ensureDir(path.dirname(dest));
        const content = await fs.readFile(src, 'utf-8');
        const { content: markdownContent, ...metadata } = await parseFrontMatter(content);
        
        // Configure marked to allow HTML
        marked.setOptions({
            headerIds: false,
            mangle: false,
            headerPrefix: '',
            gfm: true,
            breaks: true,
            sanitize: false,
            smartLists: true,
            smartypants: true,
            xhtml: false
        });
        
        let processedContent = markdownContent;
        if (data.blog_content) {
            // Replace the placeholder with the blog content before processing markdown
            processedContent = processedContent.replace('{{blog_content}}', data.blog_content);
        }
        
        // Process the markdown content first
        const htmlContent = marked(processedContent);
        
        // For blog posts, wrap the content in article structure
        let finalContent = htmlContent;
        if (src.includes('/posts/') && !data.blog_content) {
            const date = formatDate(metadata.date);
            finalContent = `<article class="post">
                <header class="post-header">
                    <h1 class="post-title">${metadata.title}</h1>
                    <time class="post-meta" datetime="${metadata.date}">${date}</time>
                </header>
                <div class="post-content">
                    ${htmlContent}
                </div>
            </article>`;
        }
        
        // Read and process the template
        const templateContent = await fs.readFile(template || 'src/template.html', 'utf-8');
        
        // Replace content and metadata in the template
        let finalHtml = templateContent
            .replace('{{{content}}}', finalContent)
            .replace('{{title}}', metadata.title || '')
            .replace('<title>Guy Margalith</title>', `<title>${metadata.title || 'Guy Margalith'}</title>`);
        
        // Write the final HTML
        await fs.writeFile(dest, finalHtml);
        console.log(`Processed: ${src} -> ${dest}`);
        
        // Return metadata and URL for blog index
        return {
            ...metadata,
            excerpt: metadata.excerpt || '',
            url: dest.replace('dist', ''),
            html: finalContent
        };
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
        await fs.copyFile('src/images/placeholder.svg', 'dist/images/placeholder.svg');
        await fs.copyFile('src/css/styles.css', 'dist/css/styles.css');
        await fs.copyFile('src/index.html', 'dist/index.html');
        
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