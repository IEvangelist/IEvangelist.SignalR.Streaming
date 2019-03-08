using IEvangelist.SignalR.Streaming.Streams;
using Microsoft.AspNetCore.SignalR;
using System.Collections.Generic;
using System.Threading;
using System.Threading.Channels;
using System.Threading.Tasks;

namespace IEvangelist.SignalR.Streaming.Hubs
{
    public class StreamHub : Hub
    {
        readonly IStreamService _streamService;

        public StreamHub(IStreamService streamService) => _streamService = streamService;

        public List<string> ListStreams()
            => _streamService.ListStreams();

        public async Task StartStream(string name, ChannelReader<string> stream)
        {
            try
            {
                var executeStreamTask = _streamService.ExecuteStreamAsync(name, stream);

                await Clients.Others.SendAsync("StreamCreated", name);
                await executeStreamTask;
            }
            finally
            {
                await Clients.Others.SendAsync("StreamRemoved", name);
            }
        }

        public ChannelReader<string> WatchStream(string name, CancellationToken token) 
            => _streamService.Subscribe(name, token);
    }
}