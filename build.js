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
    return posts.map(post => {
        const date = formatDate(post.date);
        return `### [${post.title}](${post.url})
*${date}*

${post.excerpt || ''}

[Read more →](${post.url})

---`;
    }).join('\n\n');
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
        let finalHtml = templateContent.replace('{{{content}}}', html);
        
        // Replace metadata in template
        Object.entries(metadata).forEach(([key, value]) => {
            if (typeof value === 'string') {
                finalHtml = finalHtml.replace(`{{${key}}}`, value);
            }
        });
        
        await fs.writeFile(dest, finalHtml);
        console.log(`Processed: ${src} -> ${dest}`);
        
        return { ...metadata, html, url: dest.replace('dist', '') };
    } catch (error) {
        console.error(`Error processing ${src}:`, error);
        return null;
    }
}

async function build() {
    // Create dist directory
    await fs.rm('dist', { recursive: true, force: true });
    await fs.mkdir('dist', { recursive: true });

    // Copy static assets
    await copyFile('src/css/styles.css', 'dist/css/styles.css');
    await copyFile('src/index.html', 'dist/index.html');

    try {
        await copyFile('src/js/load-templates.js', 'dist/js/load-templates.js');
    } catch (error) {
        // Ignore error if file doesn't exist
    }

    // Process blog posts first
    const blogPosts = [];
    const postsDir = 'src/content/posts';
    try {
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
    } catch (error) {
        console.error('Error processing blog posts:', error);
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

    console.log('Build completed!');
}

build().catch(console.error);