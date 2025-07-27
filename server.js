// Node.js server with DynamoDB proxy to bypass CORS
const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const url = require('url');

const server = http.createServer((req, res) => {

    const parsedUrl = url.parse(req.url, true);

    // CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    // Handle OPTIONS request for CORS
    if (req.method === 'OPTIONS') {
        res.writeHead(200);
        res.end();
        return;
    }

    // API proxy endpoint for stalls
    if (parsedUrl.pathname === '/api/stalls') {
        const options = {
            hostname: 'bfav8bi1v2.execute-api.us-east-1.amazonaws.com',
            path: '/stalls',
            method: 'GET',
            headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/json'
            }
        };

        const proxyReq = https.request(options, (proxyRes) => {
            let data = '';

            res.writeHead(proxyRes.statusCode, {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            });

            proxyRes.on('data', (chunk) => {
                data += chunk;
            });

            proxyRes.on('end', () => {
                try {
                    JSON.parse(data); // Validate JSON
                    res.end(data);
                } catch (error) {
                    console.error('❌ Invalid JSON response:', error);
                    res.end(JSON.stringify({ error: 'Failed to parse API response' }));
                }
            });
        });

        proxyReq.on('error', (error) => {
            console.error('❌ Proxy request error:', error);
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Failed to fetch from API' }));
        });

        proxyReq.end();
        return;
    }

    // FIXED: API proxy endpoint for menu items by stall ID
    if (parsedUrl.pathname === '/api/menu-items') {
        const stallId = parsedUrl.query.stallId;

        if (!stallId) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'stallId parameter is required' }));
            return;
        }

        console.log(`🍽️ Fetching menu items for stall ID: ${stallId}`);

        const options = {
            hostname: 'onoknoex1f.execute-api.us-east-1.amazonaws.com', // FIXED: Your correct API Gateway URL
            path: `/item/${stallId}`, // FIXED: Correct path
            method: 'GET',
            headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/json'
            }
        };

        console.log(`🔗 Making request to: https://${options.hostname}${options.path}`);

        const proxyReq = https.request(options, (proxyRes) => {
            let data = '';

            console.log(`📡 API Response Status: ${proxyRes.statusCode}`);

            res.writeHead(proxyRes.statusCode, {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            });

            proxyRes.on('data', (chunk) => {
                data += chunk;
            });

            proxyRes.on('end', () => {
                try {
                    const parsedData = JSON.parse(data); // Validate JSON
                    console.log(`✅ Menu items loaded for stall ${stallId}:`, parsedData);
                    res.end(data);
                } catch (error) {
                    console.error('❌ Invalid JSON response:', error);
                    console.error('Raw response data:', data);
                    res.end(JSON.stringify({ error: 'Failed to parse API response', rawData: data }));
                }
            });
        });

        proxyReq.on('error', (error) => {
            console.error('❌ Proxy request error:', error);
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Failed to fetch menu items from API' }));
        });

        proxyReq.end();
        return;
    }

    // FIXED: API proxy endpoint for items by category (for filtering)
    if (parsedUrl.pathname === '/api/items-by-category') {
        const category = parsedUrl.query.category;

        if (!category) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'category parameter is required' }));
            return;
        }

        console.log(`🏷️ Fetching items for category: ${category}`);

        const options = {
            hostname: 'onoknoex1f.execute-api.us-east-1.amazonaws.com', // FIXED: Your correct API Gateway URL
            path: `/item/category/${encodeURIComponent(category)}`, // FIXED: Correct path
            method: 'GET',
            headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/json'
            }
        };

        console.log(`🔗 Making request to: https://${options.hostname}${options.path}`);

        const proxyReq = https.request(options, (proxyRes) => {
            let data = '';

            console.log(`📡 Category API Response Status: ${proxyRes.statusCode}`);

            res.writeHead(proxyRes.statusCode, {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            });

            proxyRes.on('data', (chunk) => {
                data += chunk;
            });

            proxyRes.on('end', () => {
                try {
                    const parsedData = JSON.parse(data); // Validate JSON
                    console.log(`✅ Items loaded for category ${category}:`, parsedData);
                    res.end(data);
                } catch (error) {
                    console.error('❌ Invalid JSON response:', error);
                    console.error('Raw response data:', data);
                    res.end(JSON.stringify({ error: 'Failed to parse API response', rawData: data }));
                }
            });
        });

        proxyReq.on('error', (error) => {
            console.error('❌ Proxy request error:', error);
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Failed to fetch items by category from API' }));
        });

        proxyReq.end();
        return;
    }

    // Serve static files - Handle query parameters
    let filePath = '.' + parsedUrl.pathname;

    // Default to homepage if root
    if (filePath === './') {
        filePath = './homepage.html';
    }

    const extname = path.extname(filePath).toLowerCase();
    const mimeTypes = {
        '.html': 'text/html',
        '.js': 'text/javascript',
        '.css': 'text/css',
        '.json': 'application/json',
        '.png': 'image/png',
        '.jpg': 'image/jpg',
        '.gif': 'image/gif',
        '.svg': 'image/svg+xml',
        '.ico': 'image/x-icon'
    };

    const contentType = mimeTypes[extname] || 'application/octet-stream';

    // Log the file being requested for debugging
    console.log(`📄 Requesting file: ${filePath}`);

    fs.readFile(filePath, (error, content) => {
        if (error) {
            if (error.code == 'ENOENT') {
                console.log(`❌ File not found: ${filePath}`);
                res.writeHead(404, { 'Content-Type': 'text/html' });
                res.end(`
                    <!DOCTYPE html>
                    <html>
                    <head>
                        <title>404 - Page Not Found</title>
                        <style>
                            body { font-family: Arial, sans-serif; text-align: center; padding: 50px; }
                            h1 { color: #e74c3c; }
                            a { color: #3498db; text-decoration: none; }
                            a:hover { text-decoration: underline; }
                        </style>
                    </head>
                    <body>
                        <h1>404 - Page Not Found</h1>
                        <p>The requested file <code>${filePath}</code> was not found.</p>
                        <p><a href="/">← Back to Homepage</a></p>
                    </body>
                    </html>
                `);
            } else {
                console.log(`❌ Server error reading ${filePath}:`, error.code);
                res.writeHead(500);
                res.end('Server error: ' + error.code);
            }
        } else {
            console.log(`✅ Successfully served: ${filePath}`);
            res.writeHead(200, { 'Content-Type': contentType });
            res.end(content, 'utf-8');
        }
    });
});

const PORT = process.env.PORT || 8000;
server.listen(PORT, () => {
    console.log(`🚀 Server running at http://localhost:${PORT}/`);
    console.log(`📋 Stalls API: http://localhost:${PORT}/api/stalls`);
    console.log(`🍽️ Menu Items API: http://localhost:${PORT}/api/menu-items?stallId=<id>`);
    console.log(`🏷️ Items by Category API: http://localhost:${PORT}/api/items-by-category?category=<category>`);
    console.log(`📁 Files being served from: ${process.cwd()}`);
    console.log('');
    console.log('Available routes:');
    console.log('  • http://localhost:8000/ → homepage.html');
    console.log('  • http://localhost:8000/homepage.html');
    console.log('  • http://localhost:8000/menu.html?stallId=<id>');
    console.log('  • http://localhost:8000/login.html');
    console.log('');
    console.log('🔗 AWS API Gateway Endpoints:');
    console.log('  • Stalls: https://bfav8bi1v2.execute-api.us-east-1.amazonaws.com/stalls');
    console.log('  • Items: https://onoknoex1f.execute-api.us-east-1.amazonaws.com/item/{stall_id}');
    console.log('  • Categories: https://onoknoex1f.execute-api.us-east-1.amazonaws.com/item/category/{category}');
});
