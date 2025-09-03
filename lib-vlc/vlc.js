import { MediaPlayer } from "./libvlc.js";

export async function VLCPlayer(video) {
    let canvas = document.getElementById("canvas");
    if (canvas === null) {
        console.error("No canvas with id 'canvas' found.");
        return;
    }

    window.Module = await initModule({ 
        vlc_access_file: {},
    });

    let media_player;

    let vlc_opts_array = video.options.split(' ');

    let vlc_opts_size = 0;
    for (let i in vlc_opts_array) {
        vlc_opts_size += vlc_opts_array[i].length + 1;
    }

    let buffer = Module._malloc(vlc_opts_size);
    let wrote_size = 0;
    for (let i in vlc_opts_array) {
        Module.writeAsciiToMemory(vlc_opts_array[i], buffer + wrote_size, false);
        wrote_size += vlc_opts_array[i].length + 1;
    }

    let vlc_argv = Module._malloc(vlc_opts_array.length * 4 + 4);
    let view_vlc_argv = new Uint32Array(
        Module.wasmMemory.buffer,
        vlc_argv,
        vlc_opts_array.length
    );

    wrote_size = 0;
    for (let i in vlc_opts_array) {
        view_vlc_argv[i] = buffer + wrote_size;
        wrote_size += vlc_opts_array[i].length + 1;
    }

    Module._wasm_libvlc_init(vlc_opts_array.length, vlc_argv);
    media_player = new MediaPlayer(Module, "emjsfile://1");
    media_player.set_volume(80);

    Module._set_global_media_player(media_player.media_player_ptr);

    window.media_player = media_player;

    window.update_overlay = function() { 
        // Update position and subtitles periodically
        setInterval(function() {
            try {
                let position = media_player.get_position();
                let length = media_player.get_length();
                if (length > 0) {
                    document.getElementById("seekbar").value = (position / length) * 100;
                    
                    // Update subtitles with current time
                    if (subtitleRenderer && length > 0) {
                        let currentTime = position * length / 1000; // Convert to seconds
                        subtitleRenderer.updateSubtitles(currentTime);
                    }
                }
            } catch (e) {
                // Ignore main thread blocking warnings
            }
        }, 100);

        let media_player = window.media_player;
        try {
            let position = media_player.get_position() * 100;
            let seekbar = document.getElementById('seekbar');
            seekbar.value = position;
        } catch (error) {
            // Ignore position errors to reduce main thread blocking warnings
        }
    };

    initializeVLCControls(video);
}

function initializeVLCControls(video) { 
    let vtime = null;

    document.getElementById('play')?.addEventListener("click", async function() {
        if (vtime === null) {
            let r = await fetch(video.source);
            let blob = await r.blob()
            let file = new File([blob], "Video", { type: "video/mkv" });

            window.Module['vlc_access_file'][1] = file;
            window.files = [file];

            media_player.play();
            document.getElementById("canvas").style.width = video.size.width;
            document.getElementById("canvas").style.height = video.size.height;

            // Detect audio and subtitle tracks after media starts playing
            setTimeout(() => {
                if (window.populateAudioTracks) {
                    window.populateAudioTracks();
                }
                if (window.populateSubtitleTracks) {
                    window.populateSubtitleTracks();
                }
            }, 2000); // Increased delay for subtitle initialization

        } else {
            media_player.set_position(vtime);
            media_player.play();
        }
    });

    document.getElementById('pause')?.addEventListener("click",function() {
        vtime = media_player.get_position();
        media_player.pause();
    });

    let seekbar = document.getElementById('seekbar');
    seekbar?.addEventListener("click", function(e) {
        let position = (e.offsetX / seekbar.clientWidth);
        vtime = position;
        seekbar.value = position * 100;
        media_player.set_position(position);
    });

    let volume = document.getElementById('volume');
    volume?.addEventListener("click", function(e) {
        let position = (e.offsetX / volume.clientWidth) * 100;
        volume.value = position;
        media_player.set_volume(position);
    });

    // Audio track selection
    let audioTrackSelect = document.getElementById('audioTrack');
    audioTrackSelect?.addEventListener("change", function(e) {
        if (e.target.value !== "") {
            let trackId = parseInt(e.target.value);
            let result = media_player.set_audio_track(trackId);
            console.log('Switched to audio track:', trackId, 'Result:', result);
            
            // Verify the switch worked
            setTimeout(() => {
                let currentTrack = media_player.get_audio_track();
                console.log('Current audio track after switch:', currentTrack);
            }, 500);
        }
    });

    // Custom subtitle renderer
    let subtitleRenderer = null;
    
    // Initialize subtitle renderer after canvas is ready
    setTimeout(() => {
        subtitleRenderer = new SubtitleRenderer('canvas');
        // Load extracted subtitles
        subtitleRenderer.loadSubtitles('./subtitles/subtitle_0.vtt');
    }, 1000);

    // Subtitle track selection
    let subtitleTrackSelect = document.getElementById('subtitleTrack');
    subtitleTrackSelect?.addEventListener("change", function(e) {
        if (e.target.value !== "") {
            // Enable custom subtitle overlay
            if (subtitleRenderer) {
                subtitleRenderer.enable();
                console.log('✅ Custom subtitles enabled');
            }
        } else {
            // Disable custom subtitle overlay
            if (subtitleRenderer) {
                subtitleRenderer.disable();
                console.log('Subtitles disabled');
            }
        }
    });

    // Function to populate audio tracks
    function populateAudioTracks() {
        try {
            let trackCount = media_player.get_audio_track_count();
            console.log('Available audio tracks:', trackCount);
            
            // Clear existing options except the first one
            audioTrackSelect.innerHTML = '<option value="">Select Audio Track</option>';
            
            if (trackCount > 0) {
                let currentTrack = media_player.get_audio_track();
                console.log('Current audio track on load:', currentTrack);
                
                // Find valid tracks by testing
                let validTracks = [];
                for (let i = 0; i <= trackCount + 1; i++) {
                    try {
                        let testResult = media_player.set_audio_track(i);
                        if (testResult === 0) {
                            validTracks.push(i);
                        }
                    } catch (e) {
                        // Ignore errors
                    }
                }
                
                // Restore original track
                media_player.set_audio_track(currentTrack);
                
                console.log('Valid audio tracks:', validTracks);
                
                // Create dropdown with only valid tracks
                validTracks.forEach((trackId, index) => {
                    let option = document.createElement('option');
                    option.value = trackId;
                    option.text = `Audio Track ${index + 1}`;
                    audioTrackSelect.appendChild(option);
                });
                
                // Set current track as selected
                if (validTracks.includes(currentTrack)) {
                    audioTrackSelect.value = currentTrack;
                }
            }
        } catch (error) {
            console.log('Audio track detection:', error.message);
        }
    }

    // Function to populate subtitle tracks (now using custom renderer)
    function populateSubtitleTracks() {
        try {
            // Clear existing options
            subtitleTrackSelect.innerHTML = '<option value="">No Subtitles</option>';
            
            // Add custom subtitle option
            let option = document.createElement('option');
            option.value = '0';
            option.text = 'Subtitle 1 (Custom)';
            subtitleTrackSelect.appendChild(option);
            
            console.log('Custom subtitle track available');
        } catch (error) {
            console.log('Subtitle track setup:', error.message);
        }
    }

    // Expose functions globally for use in play button
    window.populateAudioTracks = populateAudioTracks;
    window.populateSubtitleTracks = populateSubtitleTracks;
}
