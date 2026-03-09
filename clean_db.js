const https = require('https');

const SUPABASE_URL = 'https://kyxsjdpwvmaewwxtdnxm.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt5eHNqZHB3dm1hZXd3eHRkbnhtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE1NTE5NzAsImV4cCI6MjA4NzEyNzk3MH0.gwmQ2KBifGEaiEVHZq1pPAhyGUwK7tPFTe9I8NmDPzU';

const tablesToCheck = ['workouts', 'diets', 'notifications', 'posts', 'comments', 'students', 'assessments', 'plans'];
const searchString = 'window.onerror';

function fetchTable(table) {
    return new Promise((resolve, reject) => {
        const options = {
            hostname: 'kyxsjdpwvmaewwxtdnxm.supabase.co',
            port: 443,
            path: `/rest/v1/${table}?select=*`,
            method: 'GET',
            headers: {
                'apikey': SUPABASE_ANON_KEY,
                'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
                'Range': '0-1000'
            }
        };
        const req = https.request(options, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                if (res.statusCode >= 200 && res.statusCode < 300) resolve(JSON.parse(data));
                else resolve([]);
            });
        });
        req.on('error', e => resolve([]));
        req.end();
    });
}

function deleteRow(table, id) {
    return new Promise((resolve) => {
        const options = {
            hostname: 'kyxsjdpwvmaewwxtdnxm.supabase.co',
            port: 443,
            path: `/rest/v1/${table}?id=eq.${id}`,
            method: 'DELETE',
            headers: {
                'apikey': SUPABASE_ANON_KEY,
                'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
            }
        };
        const req = https.request(options, res => resolve(res.statusCode));
        req.on('error', e => resolve(500));
        req.end();
    });
}

async function run() {
    for (const table of tablesToCheck) {
        console.log(`Checking table ${table}...`);
        const rows = await fetchTable(table);
        for (const row of rows) {
            const jsonStr = JSON.stringify(row);
            if (jsonStr.includes(searchString) || jsonStr.includes('Global Error:')) {
                console.log(`Found string in table ${table}, row id: ${row.id}. DELETING!`);
                const status = await deleteRow(table, row.id);
                console.log(`Deleted result: ${status}`);
            }
        }
    }
    console.log("Cleanup complete!");
}

run();
