using Microsoft.EntityFrameworkCore;
using lab3_PRN.Models;

namespace lab3_PRN.Data;

public class ChatDbContext : DbContext
{
    public ChatDbContext(DbContextOptions<ChatDbContext> options) : base(options)
    {
    }

    public DbSet<ChatRoom> ChatRooms => Set<ChatRoom>();
}
