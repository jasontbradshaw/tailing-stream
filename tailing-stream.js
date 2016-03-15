var fs = require('fs');
var Readable = require('stream').Readable;

// copy properties from right-most args to left-most
var extend = function (preserveExistingProperties) {
  var result = undefined;
  for (var i = 1; i < arguments.length; i++) {
    obj = arguments[i];

    // set initial result object to the first argument given
    if (!result) {
      result = obj;
      continue;
    }

    for (prop in obj) {
      if (Object.prototype.hasOwnProperty.call(obj, prop)) {
        // preserve preexisting child properties if specified
        if (preserveExistingProperties &&
            Object.prototype.hasOwnProperty.call(result, prop)) {
              continue;
            }
        result[prop] = obj[prop];
      }
    }
  }

  return result;
}

var TailingReadableStream = function () {
  // run Readable's init code on us, since we're a Readable
  Readable.call(this);

  // whether the stream can be read from
  this.readable = true;

  // time before a tailing file is considered 'done'
  this.timeout = 5000;

  // options passed to created ReadableStreams
  this._read_stream_options = {};

  this._path = null;
  this._stream = null;
  this._watcher = null;
  this._offset = 0;
  this._timeoutId = null;

  this._paused = false;
};

// 'inherit' from Readable
TailingReadableStream.prototype = Object.create(Readable.prototype, {
  constructor: {
    value: TailingReadableStream,
  enumerable: false
  }
});
extend(true, TailingReadableStream, Readable);

// create a new TailingReadableStream and return it
TailingReadableStream.open = function (path, options) {
  options = options || {};

  var file = new TailingReadableStream();

  // override the timeout if present in options
  if (Object.prototype.hasOwnProperty.call(options, 'timeout')) {
    file.timeout = options.timeout;
  }

  // set the reading start point if specified
  if (Object.prototype.hasOwnProperty.call(options, 'start')) {
    file._offset = options.start;
  }

  // do not start emitting data events if specified and true
  if (Object.prototype.hasOwnProperty.call(options, 'startPaused')) {
    file._paused = options.startPaused;
  }

  // store options for use when opening ReadableStreams, sans 'end'
  extend(false, file._read_stream_options, options);
  delete file._read_stream_options.end;

  file._path = path;
  if (!file._paused) {
    file._watch();
  }

  return file;
};

// start watching the file for size changes
TailingReadableStream.prototype._watch = function () {
  var self = this;

  // watch the file for changes
  this._watcher = fs.watch(this._path);
  this._watcher.on('change', function (event, fileName) {
    // reset the kill switch for inactivity on every non-paused change
    self._resetTimeoutKillswitch();

    // start a new stream if one isn't running and a change happened
    if (!self._stream && self.readable && event === 'change') {
      // send all data from the last byte sent to EOF
      var readOpts = extend(false, {}, self._read_stream_options);
      readOpts.start = self._offset;
      self._stream = fs.createReadStream(self._path, readOpts);

      // pipe data through our own event while tracking its progress
      self._stream.on('data', function (data) {
        // track the amount of data that's been read, then forward
        self._offset += data.length;
        self.emit('data', data)
      });

      // forward errors and close the stream when received
      self._stream.on('error', function (exception) {
        self._destroy();
        self.emit('error', exception);
        self.emit('close');
      });

      // when we reach the end, destroy the stream and null it out so a
      // new one will be created for the next file change.
      self._stream.on('end', function () {
        self._stream.destroy();
        self._stream = null;
      });
    }
  });

  // destroy then forward errors
  this._watcher.on('error', function (exception) {
    self._destroy();
    self.emit('error', exception);
    self.emit('close');
  });

  // trigger initial change event to force streaming of existing file data
  this._watcher.emit('change', 'change', this._path);
};

// update the encoding of data sent to 'data' events
TailingReadableStream.prototype.setEncoding = function (encoding) {
  // set the default
  encoding = encoding || 'utf8';

  // update the read options
  this._read_stream_options.encoding = encoding;

  // update any live stream
  if (this._stream) {
    this._stream.setEncoding(encoding);
  }
};

// pause stream reading for a while
TailingReadableStream.prototype.pause = function () {
  if (!this._paused) {
    this._paused = true;

    // stop watching the file (restarts when resume is called)
    if (this._watcher) {
      this._watcher.close();
      this._watcher = null;
    }

    // clear the timeout kill switch
    clearTimeout(this._timeoutId);
    this._timeoutId = null;

    // pause any existing stream
    if (this._stream) {
      this._stream.pause();
    }
  }
};

// resume watching/reading from the file
TailingReadableStream.prototype.resume = function () {
  if (this._paused) {
    this._paused = false;

    // resume any existing stream and start watching/reading again
    this._watch();
    if (this._stream) {
      this._stream.resume();
    }
  }
};

// start checking for changes, clearing any existing checks
TailingReadableStream.prototype._resetTimeoutKillswitch = function () {
  // set a timeout to check for non-activity. setTimeout() is used to allow
  // the user to dynamically change the timeout duration, if desired.
  clearTimeout(this._timeoutId);

  // set a new timeout unless timeout is disabled
  if (this.timeout) {
    this._timeoutId = setTimeout(this._timeoutKillswitch.bind(this),
        this.timeout);
  }
};

// stop watching/reading the file and stop emitting events
TailingReadableStream.prototype._destroy = function () {
  // pause to stop the watcher and clear the kill switch
  this.pause();

  // close any existing read stream
  if (this._stream) {
    this._stream.destroy();
    this._stream = null;
  }

  // mark that we're no longer readable or paused
  this.readable = false;
  this._paused = false;
};

// shut down the stream and emit end and close events
TailingReadableStream.prototype._timeoutKillswitch = function () {
  this._destroy();
  this.emit('end');
  this.emit('close');
};

// destroy the stream
TailingReadableStream.prototype.destroy = function () {
  this._destroy();
  this.emit('close');
};

// build a tailing readable stream given a path and some options
var createTailingReadStream = function (path, options) {
  return TailingReadableStream.open(path, options);
};

// exports
module.exports.createReadStream = createTailingReadStream;
module.exports.TailingReadableStream = TailingReadableStream;
