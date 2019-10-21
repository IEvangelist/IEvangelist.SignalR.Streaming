using Microsoft.AspNetCore.SignalR;
using System.Collections.Concurrent;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Channels;
using System.Threading.Tasks;

namespace IEvangelist.SignalR.Streaming.Streams
{
    public class StreamService : IStreamService
    {
        long _globalClientId;

        readonly ConcurrentDictionary<string, StreamReference> _streams = 
            new ConcurrentDictionary<string, StreamReference>();

        public List<string> ListStreams() => _streams.Keys.ToList();

        public async Task ExecuteStreamAsync(string name, IAsyncEnumerable<string> stream)
        {
            var streamReference = new StreamReference(stream);

            _streams.TryAdd(name, streamReference);

            await Task.Yield();

            try
            {
                await foreach (var item in stream)
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

        public IAsyncEnumerable<string> Subscribe(string name, CancellationToken token)
        {
            if (!_streams.TryGetValue(name, out var source))
            {
                throw new HubException($"The '{name}' stream doesn't exist.");
            }

            var id = Interlocked.Increment(ref _globalClientId);
            var channel = Channel.CreateBounded<string>(new BoundedChannelOptions(2)
            {
                FullMode = BoundedChannelFullMode.DropOldest
            });

            source.Viewers.TryAdd(id, channel);

            // Register for client closing stream, this token 
            // will always fire (handled by SignalR).
            token.Register(() => source.Viewers.TryRemove(id, out _));

            return channel.Reader.ReadAllAsync();
        }
    }
}