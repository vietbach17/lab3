using System;
using Microsoft.EntityFrameworkCore;
using lab3_PRN.Data;
using lab3_PRN.Hubs;

var builder = WebApplication.CreateBuilder(args);

// Add CORS services
builder.Services.AddCors(options =>
{
    options.AddDefaultPolicy(policy =>
    {
        policy.SetIsOriginAllowed(origin => true)
              .AllowAnyHeader()
              .AllowAnyMethod()
              .AllowCredentials();
    });
});

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
            new lab3_PRN.Models.ChatRoom { Id = "general", Name = "Kênh Chung (General)", Avatar = "💬" }
        );
        await context.SaveChangesAsync();
    }
}

// Print Server IP addresses on startup
app.Lifetime.ApplicationStarted.Register(() =>
{
    try
    {
        var hostName = System.Net.Dns.GetHostName();
        var ipEntry = System.Net.Dns.GetHostEntry(hostName);
        
        Console.WriteLine("\n=======================================================");
        Console.WriteLine("ĐỊA CHỈ IP LAN MÁY CHỦ CỦA BẠN:");
        Console.WriteLine("Các thành viên khác có thể kết nối tới máy bạn bằng IP:");
        
        foreach (var ip in ipEntry.AddressList)
        {
            if (ip.AddressFamily == System.Net.Sockets.AddressFamily.InterNetwork)
            {
                Console.WriteLine($" -> http://{ip}:5000 (Chạy lệnh: dotnet run --urls \"http://0.0.0.0:5000\")");
            }
        }
        Console.WriteLine("=======================================================\n");
    }
    catch (Exception ex)
    {
        Console.WriteLine($"Không thể xác định địa chỉ IP máy chủ: {ex.Message}");
    }
});

// Configure the HTTP request pipeline.
if (!app.Environment.IsDevelopment())
{
    app.UseExceptionHandler("/Error");
    app.UseHsts();
}

app.UseHttpsRedirection();
app.UseStaticFiles();

app.UseRouting();

// Apply CORS policy
app.UseCors();

app.UseAuthorization();

app.MapRazorPages();
app.MapHub<ChatHub>("/chatHub");

app.Run();
