using System.Collections.Generic;
using System.Threading;
using System.Threading.Tasks;

namespace IEvangelist.SignalR.Streaming.Streams
{
    public interface IStreamService
    {
        List<string> ListStreams();

        Task ExecuteStreamAsync(string name, IAsyncEnumerable<string> stream);

        IAsyncEnumerable<string> Subscribe(string name, CancellationToken token);
    }
}