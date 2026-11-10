const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const config = getDefaultConfig(__dirname);

// The app never imports these. Leaving them in Metro's file map (the 12 GB voice runtime in workers/, the server and
// the job files it keeps writing to server/tmp) makes the dev server crawl and re-index them until it runs out of memory.
const ignored = ['workers', 'server', 'dist', 'example', 'refs', 'supabase'].map(
  (dir) => new RegExp(`^${path.join(__dirname, dir).replace(/[/\\^$.*+?()[\]{}|]/g, '\\$&')}[/\\\\].*`)
);
config.resolver.blockList = [...[].concat(config.resolver.blockList ?? []), ...ignored];

module.exports = config;
