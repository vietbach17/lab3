using System;
using lab3_PRN.Hubs;

Console.OutputEncoding = System.Text.Encoding.UTF8;

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

var app = builder.Build();

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
                Console.WriteLine($" -> http://{ip}:5000");
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
