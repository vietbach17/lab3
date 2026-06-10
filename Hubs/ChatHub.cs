using System;
using System.Threading.Tasks;
using Microsoft.AspNetCore.SignalR;
using lab3_PRN.Models;

namespace lab3_PRN.Hubs;

public class ChatHub : Hub
{
    public ChatHub()
    {
    }

    public async Task JoinRoom(string roomId)
    {
        await Groups.AddToGroupAsync(Context.ConnectionId, roomId);
        // Inform others in room that a user connected
        await Clients.OthersInGroup(roomId).SendAsync("UserJoined", Context.ConnectionId);
    }

    public async Task SendMessage(string roomId, string sender, string content, string? fileUrl = null, string? fileName = null, string? fileType = null, long? fileSize = null)
    {
        var message = new Message
        {
            Id = Random.Shared.Next(1, 10000000),
            ChatRoomId = roomId,
            Sender = sender,
            Content = content,
            Timestamp = DateTime.UtcNow,
            FileUrl = fileUrl,
            FileName = fileName,
            FileType = fileType,
            FileSize = fileSize
        };

        await Clients.Group(roomId).SendAsync("ReceiveMessage", new
        {
            id = message.Id,
            sender = message.Sender,
            content = message.Content,
            timestamp = message.Timestamp.ToString("o"),
            fileUrl = message.FileUrl,
            fileName = message.FileName,
            fileType = message.FileType,
            fileSize = message.FileSize
        });
    }

    public async Task SendTyping(string roomId, string sender, bool isTyping)
    {
        await Clients.OthersInGroup(roomId).SendAsync("ReceiveTyping", sender, isTyping);
    }
}
