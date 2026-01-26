/**
 * Basic Express server for Brass Roguelike
 * Serves static files and will handle LilyPond integration later
 */

const express = require('express');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Serve static files from client directory
app.use(express.static(path.join(__dirname, '../client')));

// JSON parsing for API endpoints
app.use(express.json());

// API: Get available excerpts
app.get('/api/excerpts', (req, res) => {
    // TODO: Load from excerpts directory
    res.json({
        excerpts: [
            { id: 1, name: 'Simple Scale', difficulty: 1 },
            { id: 2, name: 'Alternating Notes', difficulty: 1 },
            { id: 3, name: 'Scale Down', difficulty: 2 }
        ]
    });
});

// API: Generate LilyPond notation image
app.post('/api/generate-notation', (req, res) => {
    // TODO: Implement LilyPond generation
    const { notes, key, clef } = req.body;

    res.json({
        success: false,
        message: 'LilyPond generation not yet implemented',
        notes
    });
});

// Health check
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Start server
app.listen(PORT, () => {
    console.log(`Brass Roguelike server running at http://localhost:${PORT}`);
    console.log(`Open http://localhost:${PORT} in your browser to play`);
});
