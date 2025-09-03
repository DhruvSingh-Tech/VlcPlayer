const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

/**
 * Extract subtitles from MKV file using ffmpeg
 * @param {string} videoFile - Path to MKV file
 * @param {string} outputDir - Directory to save subtitle files
 */
async function extractSubtitles(videoFile, outputDir = './subtitles') {
    return new Promise((resolve, reject) => {
        // Create output directory if it doesn't exist
        if (!fs.existsSync(outputDir)) {
            fs.mkdirSync(outputDir, { recursive: true });
        }

        // Get video info first
        const ffprobe = spawn('ffprobe', [
            '-v', 'quiet',
            '-print_format', 'json',
            '-show_streams',
            videoFile
        ]);

        let probeOutput = '';
        ffprobe.stdout.on('data', (data) => {
            probeOutput += data.toString();
        });

        ffprobe.on('close', (code) => {
            if (code !== 0) {
                reject(new Error('Failed to probe video file'));
                return;
            }

            try {
                const info = JSON.parse(probeOutput);
                const subtitleStreams = info.streams.filter(stream => 
                    stream.codec_type === 'subtitle'
                );

                if (subtitleStreams.length === 0) {
                    reject(new Error('No subtitle streams found'));
                    return;
                }

                console.log(`Found ${subtitleStreams.length} subtitle stream(s)`);

                // Extract each subtitle stream
                const extractions = subtitleStreams.map((stream, index) => {
                    return new Promise((resolveExtract, rejectExtract) => {
                        const outputFile = path.join(outputDir, `subtitle_${index}.vtt`);
                        
                        const ffmpeg = spawn('ffmpeg', [
                            '-i', videoFile,
                            '-map', `0:s:${index}`,
                            '-c:s', 'webvtt',
                            '-y', // Overwrite output files
                            outputFile
                        ]);

                        ffmpeg.on('close', (extractCode) => {
                            if (extractCode === 0) {
                                console.log(`Extracted subtitle ${index} to ${outputFile}`);
                                resolveExtract({
                                    index,
                                    file: outputFile,
                                    language: stream.tags?.language || 'unknown'
                                });
                            } else {
                                rejectExtract(new Error(`Failed to extract subtitle ${index}`));
                            }
                        });

                        ffmpeg.stderr.on('data', (data) => {
                            // Log ffmpeg errors if needed
                            // console.error(`ffmpeg stderr: ${data}`);
                        });
                    });
                });

                Promise.all(extractions)
                    .then(results => resolve(results))
                    .catch(err => reject(err));

            } catch (parseError) {
                reject(new Error('Failed to parse video info'));
            }
        });

        ffprobe.stderr.on('data', (data) => {
            // Log ffprobe errors if needed
            // console.error(`ffprobe stderr: ${data}`);
        });
    });
}

// Export for use in other files
module.exports = { extractSubtitles };

// CLI usage
if (require.main === module) {
    const videoFile = process.argv[2];
    if (!videoFile) {
        console.error('Usage: node extract-subtitles.js <video-file>');
        process.exit(1);
    }

    extractSubtitles(videoFile)
        .then(results => {
            console.log('Extraction complete:');
            results.forEach(result => {
                console.log(`- ${result.file} (${result.language})`);
            });
        })
        .catch(err => {
            console.error('Error:', err.message);
            process.exit(1);
        });
}
