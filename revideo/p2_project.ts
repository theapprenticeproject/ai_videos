
import { makeProject } from '@revideo/core';
import p2 from './p2';

export default makeProject({
  scenes: [p2],
  settings: {
    shared: {
      size: { x: 1280, y: 720 },
    },
    rendering: {
      // resolutionScale:0.75,
      exporter: {
        name: '@revideo/core/ffmpeg',
        options: {
          format: 'mp4'
        },
        
      }
    }
  },
});
