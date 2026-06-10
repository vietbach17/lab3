using Microsoft.EntityFrameworkCore;
using lab3_PRN.Data;
using lab3_PRN.Hubs;

var builder = WebApplication.CreateBuilder(args);

// Add services to the container.
builder.Services.AddRazorPages();

// Configure SignalR
builder.Services.AddSignalR(options =>
{
    options.EnableDetailedErrors = true;
});

// Configure SQLite DB
builder.Services.AddDbContext<ChatDbContext>(options =>
    options.UseSqlite(builder.Configuration.GetConnectionString("DefaultConnection")));

var app = builder.Build();

// Seed database
using (var scope = app.Services.CreateScope())
{
    var context = scope.ServiceProvider.GetRequiredService<ChatDbContext>();
    context.Database.EnsureCreated();
    
    // Seed default chat channels
    if (!await context.ChatRooms.AnyAsync())
    {
        await context.ChatRooms.AddRangeAsync(
            new lab3_PRN.Models.ChatRoom { Id = "general", Name = "Kênh Chung (General)", Avatar = "💬" },
            new lab3_PRN.Models.ChatRoom { Id = "design", Name = "Nhóm Thiết Kế UI/UX", Avatar = "🎨" },
            new lab3_PRN.Models.ChatRoom { Id = "dev", Name = "Kênh Lập Trình Viên", Avatar = "💻" }
        );
        await context.SaveChangesAsync();
    }
}

// Configure the HTTP request pipeline.
if (!app.Environment.IsDevelopment())
{
    app.UseExceptionHandler("/Error");
    app.UseHsts();
}

app.UseHttpsRedirection();
app.UseStaticFiles();

app.UseRouting();

app.UseAuthorization();

app.MapRazorPages();
app.MapHub<ChatHub>("/chatHub");

app.Run();
