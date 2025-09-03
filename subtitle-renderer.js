/**
 * Custom subtitle renderer for VLC Player
 * Parses WebVTT files and displays subtitles over video canvas
 */
class SubtitleRenderer {
    constructor(canvasId) {
        this.canvas = document.getElementById(canvasId);
        this.subtitles = [];
        this.currentSubtitle = null;
        this.subtitleElement = null;
        this.isEnabled = false;
        
        this.createSubtitleOverlay();
    }

    createSubtitleOverlay() {
        // Create subtitle overlay div
        this.subtitleElement = document.createElement('div');
        this.subtitleElement.id = 'subtitle-overlay';
        this.subtitleElement.style.cssText = `
            position: absolute;
            bottom: 20px;
            left: 50%;
            transform: translateX(-50%);
            color: white;
            font-size: 18px;
            font-family: Arial, sans-serif;
            text-align: center;
            text-shadow: 2px 2px 4px rgba(0,0,0,0.8);
            background: rgba(0,0,0,0.5);
            padding: 8px 16px;
            border-radius: 4px;
            max-width: 80%;
            z-index: 1000;
            display: none;
            white-space: pre-line;
        `;
        
        // Position relative to canvas
        const canvasContainer = this.canvas.parentElement;
        canvasContainer.style.position = 'relative';
        canvasContainer.appendChild(this.subtitleElement);
    }

    async loadSubtitles(vttUrl) {
        try {
            const response = await fetch(vttUrl);
            const vttText = await response.text();
            this.subtitles = this.parseWebVTT(vttText);
            console.log(`Loaded ${this.subtitles.length} subtitle cues`);
            return true;
        } catch (error) {
            console.error('Failed to load subtitles:', error);
            return false;
        }
    }

    parseWebVTT(vttText) {
        const lines = vttText.split('\n');
        const cues = [];
        let i = 0;

        // Skip WEBVTT header
        while (i < lines.length && !lines[i].includes('-->')) {
            i++;
        }

        while (i < lines.length) {
            const line = lines[i].trim();
            
            if (line.includes('-->')) {
                const [startTime, endTime] = line.split('-->').map(t => t.trim());
                const start = this.parseTimestamp(startTime);
                const end = this.parseTimestamp(endTime);
                
                // Get subtitle text (next non-empty lines)
                i++;
                let text = '';
                while (i < lines.length && lines[i].trim() !== '') {
                    if (text) text += '\n';
                    text += lines[i].trim();
                    i++;
                }
                
                if (text) {
                    cues.push({ start, end, text });
                }
            }
            i++;
        }

        return cues.sort((a, b) => a.start - b.start);
    }

    parseTimestamp(timeStr) {
        // Parse WebVTT timestamp (HH:MM:SS.mmm)
        const parts = timeStr.split(':');
        const seconds = parts[parts.length - 1];
        const minutes = parts[parts.length - 2] || '0';
        const hours = parts[parts.length - 3] || '0';
        
        const [sec, ms] = seconds.split('.');
        return (
            parseInt(hours) * 3600 +
            parseInt(minutes) * 60 +
            parseInt(sec) +
            (ms ? parseInt(ms) / 1000 : 0)
        );
    }

    updateSubtitles(currentTime) {
        if (!this.isEnabled || this.subtitles.length === 0) {
            this.hideSubtitle();
            return;
        }

        // Find current subtitle
        const current = this.subtitles.find(cue => 
            currentTime >= cue.start && currentTime <= cue.end
        );

        if (current && current !== this.currentSubtitle) {
            this.showSubtitle(current.text);
            this.currentSubtitle = current;
        } else if (!current && this.currentSubtitle) {
            this.hideSubtitle();
            this.currentSubtitle = null;
        }
    }

    showSubtitle(text) {
        this.subtitleElement.textContent = text;
        this.subtitleElement.style.display = 'block';
    }

    hideSubtitle() {
        this.subtitleElement.style.display = 'none';
    }

    enable() {
        this.isEnabled = true;
        console.log('Subtitles enabled');
    }

    disable() {
        this.isEnabled = false;
        this.hideSubtitle();
        this.currentSubtitle = null;
        console.log('Subtitles disabled');
    }

    toggle() {
        if (this.isEnabled) {
            this.disable();
        } else {
            this.enable();
        }
        return this.isEnabled;
    }
}

// Export for use in other files
if (typeof module !== 'undefined' && module.exports) {
    module.exports = SubtitleRenderer;
}
