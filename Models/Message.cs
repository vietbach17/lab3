using System;
using System.ComponentModel.DataAnnotations;

namespace lab3_PRN.Models;

public class Message
{
    [Key]
    public int Id { get; set; }

    [Required]
    public string Sender { get; set; } = string.Empty;

    [Required]
    public string Content { get; set; } = string.Empty;

    public DateTime Timestamp { get; set; } = DateTime.UtcNow;

    // Room connection
    [Required]
    public string ChatRoomId { get; set; } = string.Empty;
    public ChatRoom? ChatRoom { get; set; }

    // File attachments
    public string? FileUrl { get; set; }
    public string? FileName { get; set; }
    public string? FileType { get; set; } // "image", "file"
    public long? FileSize { get; set; }
}
