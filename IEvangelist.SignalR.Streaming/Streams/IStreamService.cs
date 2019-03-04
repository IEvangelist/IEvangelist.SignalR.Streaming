using System.Collections.Generic;
using System.Threading;
using System.Threading.Channels;
using System.Threading.Tasks;

namespace IEvangelist.SignalR.Streaming.Streams
{
    public interface IStreamService
    {
        IList<string> GetAvailableStreams();

        Task ExecuteStreamAsync(string name, ChannelReader<string> stream);

        ChannelReader<string> WatchStream(string name, CancellationToken token);
    }
}