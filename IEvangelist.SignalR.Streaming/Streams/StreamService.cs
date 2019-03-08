using Microsoft.AspNetCore.SignalR;
using System.Collections.Concurrent;
using System.Collections.Generic;
using System.Threading;
using System.Threading.Channels;
using System.Threading.Tasks;

namespace IEvangelist.SignalR.Streaming.Streams
{
    public class StreamService : IStreamService
    {
        long _globalClientId;
        readonly ConcurrentDictionary<string, StreamReference> _streams;

        public StreamService() => _streams = new ConcurrentDictionary<string, StreamReference>();

        public List<string> ListStreams()
        {
            var streams = new List<string>();
            foreach(var stream in _streams.Keys)
            {
                streams.Add(stream);
            }
            return streams;
        }

        public async Task ExecuteStreamAsync(string name, ChannelReader<string> stream)
        {
            var streamReference = new StreamReference(stream);

            // Add before yielding
            // This fixes a race where we tell clients a new stream arrives before adding the stream
            _streams.TryAdd(name, streamReference);

            await Task.Yield();

            try
            {
                while (await stream.WaitToReadAsync())
                {
                    while (stream.TryRead(out var item))
                    {
                        foreach (var viewer in streamReference.Viewers)
                        {
                            try
                            {
                                await viewer.Value.Writer.WriteAsync(item);
                            }
                            catch { }
                        }
                    }
                }
            }
            finally
            {
                TryRemoveStream(name);
            }
        }

        void TryRemoveStream(string name)
        {
            if (_streams.TryRemove(name, out var streamReference))
            {
                foreach (var viewer in streamReference.Viewers)
                {
                    viewer.Value.Writer.TryComplete();
                }
            }
        }

        public ChannelReader<string> Subscribe(string name, CancellationToken token)
        {
            if (!_streams.TryGetValue(name, out var streamReference))
            {
                throw new HubException("stream doesn't exist");
            }

            var id = Interlocked.Increment(ref _globalClientId);
            var channel = Channel.CreateBounded<string>(new BoundedChannelOptions(2)
            {
                FullMode = BoundedChannelFullMode.DropOldest
            });

            streamReference.Viewers.TryAdd(id, channel);

            // Register for client closing stream, this token will always fire (handled by SignalR)
            token.Register(() => streamReference.Viewers.TryRemove(id, out _));

            return channel.Reader;
        }
    }
}