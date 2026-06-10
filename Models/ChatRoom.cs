using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;

namespace lab3_PRN.Models;

public class ChatRoom
{
    [Key]
    public string Id { get; set; } = Guid.NewGuid().ToString();

    [Required]
    [MaxLength(100)]
    public string Name { get; set; } = string.Empty;

    public string? Avatar { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public ICollection<Message> Messages { get; set; } = new List<Message>();
}
