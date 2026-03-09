const https = require('https');
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt5eHNqZHB3dm1hZXd3eHRkbnhtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE1NTE5NzAsImV4cCI6MjA4NzEyNzk3MH0.gwmQ2KBifGEaiEVHZq1pPAhyGUwK7tPFTe9I8NmDPzU';

function fetchTable(table) {
    return new Promise((resolve, reject) => {
        const options = {
            hostname: 'kyxsjdpwvmaewwxtdnxm.supabase.co',
            port: 443,
            path: `/rest/v1/${table}?select=*`,
            method: 'GET',
            headers: {
                'apikey': SUPABASE_ANON_KEY,
                'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
            }
        };
        const req = https.request(options, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => resolve(JSON.parse(data)));
        });
        req.end();
    });
}

fetchTable('activity_logs').then(console.log);
