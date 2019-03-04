using System.Collections.Concurrent;
using System.Threading.Channels;

namespace IEvangelist.SignalR.Streaming.Streams
{
    class StreamReference
    {
        readonly ChannelReader<string> _stream;

        internal ConcurrentDictionary<long, Channel<string>> Viewers { get; } =
            new ConcurrentDictionary<long, Channel<string>>();

        internal StreamReference(ChannelReader<string> stream) => _stream = stream;
    }
}