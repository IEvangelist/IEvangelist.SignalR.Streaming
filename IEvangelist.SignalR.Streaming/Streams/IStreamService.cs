using System.Collections.Generic;
using System.Threading;
using System.Threading.Channels;
using System.Threading.Tasks;

namespace IEvangelist.SignalR.Streaming.Streams
{
    public interface IStreamService
    {
        List<string> ListStreams();

        Task ExecuteStreamAsync(string name, ChannelReader<string> stream);

        ChannelReader<string> Subscribe(string name, CancellationToken token);
    }
}