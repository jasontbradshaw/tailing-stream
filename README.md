# tailing-stream #
`tailing-stream` is a Node.js module that provides a Stream that can read
continuously from a file that's being actively written to. This is in contrast
to the standard
[`fs.createReadStream`](http://nodejs.org/api/fs.html#fs_fs_createreadstream_path_options).
method, which returns a `ReadableStream` that stops reading once it gets to the
last byte that existed at the time the stream was originally opened. It supports
exactly the same interface as a Node
[`ReadableStream`](http://nodejs.org/api/stream.html#stream_readable_stream), and
its `createReadStream` method functions the same as `fs.createReadStream`.

## Interface ##
A `TailingReadableStream` supports all the same methods and configuration
options as a normal `ReadableStream`, so I suggest you read
[the node documentation](http://nodejs.org/api/stream.html#stream_readable_stream) if you're
looking for a detailed description. The only difference is that a
`TailingReadableStream` doesn't recognize the `end` option, since it wouldn't
make much sense to create one if you planned to stop reading at a predetermined
point!

### TailingReadableStream Constructor ###
It takes two unique configuration options, `timeout` and `pause`. 

**timeout**

 * A Number that specifies the amount of time in milliseconds that should elapse before a file 
 is considered to have 'finished' tailing. If omitted, it defaults to 5000ms. If 
 set to a falsy value, the timeout is disabled and the stream will wait indefinitely
 for new content to arrive. Beware: if the timeout is set too low (say, to 1ms), 
 the stream could very well close files that are still being written to if 'data' 
 events don't come in quickly enough.

* If a timeout occurs, an `end` event is sent to replicate the file closing.

**startPaused**

* A Boolean that when set to `true` will prevent the underlying stream from immediately 
instantiating in addition to preventing `fs.watch` from emitting `data` events. Defaults
to `false`.

* _NOTE_: If this option is set to `true` you must call `resume()` on your stream object 
in order to lazily instantiate the underlying stream and begin watching it for changes. 


## Implementation ##
Internally, `TailingReadableStream` uses the
[`fs.watch`](http://nodejs.org/api/fs.html#fs_fs_watch_filename_options_listener)
method to watch for file changes, and creates `ReadableStream`s to read the
changed contents. If `fs.watch` performs peculiarly on your platform of choice,
its foibles will be replicated in `TailingReadableStream`.

## License ##
`tailing-stream` is MIT licensed, so throw caution to the wind and have at it!
