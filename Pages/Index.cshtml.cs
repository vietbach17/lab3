using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.RazorPages;
using Microsoft.EntityFrameworkCore;
using lab3_PRN.Data;
using lab3_PRN.Models;

namespace lab3_PRN.Pages;

[IgnoreAntiforgeryToken]
public class IndexModel : PageModel
{
    private readonly ILogger<IndexModel> _logger;
    private readonly ChatDbContext _context;
    private readonly IWebHostEnvironment _environment;

    public List<ChatRoom> ChatRooms { get; set; } = new();
    public List<Message> Messages { get; set; } = new();
    public string ActiveRoomId { get; set; } = "general";

    public IndexModel(ILogger<IndexModel> logger, ChatDbContext context, IWebHostEnvironment environment)
    {
        _logger = logger;
        _context = context;
        _environment = environment;
    }

    public async Task OnGetAsync(string? roomId)
    {
        if (!string.IsNullOrEmpty(roomId))
        {
            ActiveRoomId = roomId;
        }

        ChatRooms = await _context.ChatRooms.ToListAsync();
        
        Messages = await _context.Messages
            .Where(m => m.ChatRoomId == ActiveRoomId)
            .OrderBy(m => m.Timestamp)
            .ToListAsync();
    }

    public async Task<IActionResult> OnGetMessagesAsync(string roomId)
    {
        var messages = await _context.Messages
            .Where(m => m.ChatRoomId == roomId)
            .OrderBy(m => m.Timestamp)
            .Select(m => new
            {
                id = m.Id,
                sender = m.Sender,
                content = m.Content,
                timestamp = m.Timestamp.ToString("o"),
                fileUrl = m.FileUrl,
                fileName = m.FileName,
                fileType = m.FileType,
                fileSize = m.FileSize
            })
            .ToListAsync();

        return new JsonResult(messages);
    }

    public async Task<IActionResult> OnPostUploadChunkAsync(
        IFormFile chunk, 
        string fileId, 
        int chunkIndex, 
        int totalChunks, 
        string fileName)
    {
        try
        {
            if (chunk == null || chunk.Length == 0)
            {
                return BadRequest("No chunk data received.");
            }

            var uploadsFolder = Path.Combine(_environment.WebRootPath, "uploads");
            var tempFolder = Path.Combine(uploadsFolder, "temp", fileId);
            
            if (!Directory.Exists(tempFolder))
            {
                Directory.CreateDirectory(tempFolder);
            }

            var chunkFilePath = Path.Combine(tempFolder, $"{chunkIndex}.tmp");
            
            using (var stream = new FileStream(chunkFilePath, FileMode.Create, FileAccess.Write, FileShare.None))
            {
                await chunk.CopyToAsync(stream);
            }

            var uploadedChunksCount = Directory.GetFiles(tempFolder, "*.tmp").Length;
            if (uploadedChunksCount == totalChunks)
            {
                var finalFilePath = Path.Combine(uploadsFolder, fileName);
                
                if (System.IO.File.Exists(finalFilePath))
                {
                    var nameWithoutExtension = Path.GetFileNameWithoutExtension(fileName);
                    var extension = Path.GetExtension(fileName);
                    fileName = $"{nameWithoutExtension}_{Guid.NewGuid().ToString().Substring(0, 8)}{extension}";
                    finalFilePath = Path.Combine(uploadsFolder, fileName);
                }

                using (var outputStream = new FileStream(finalFilePath, FileMode.Create, FileAccess.Write, FileShare.None))
                {
                    for (int i = 0; i < totalChunks; i++)
                    {
                        var partPath = Path.Combine(tempFolder, $"{i}.tmp");
                        if (!System.IO.File.Exists(partPath))
                        {
                            return BadRequest($"Chunk {i} is missing.");
                        }

                        using (var inputStream = new FileStream(partPath, FileMode.Open, FileAccess.Read, FileShare.Read))
                        {
                            await inputStream.CopyToAsync(outputStream);
                        }
                    }
                }

                Directory.Delete(tempFolder, true);

                var fileInfo = new FileInfo(finalFilePath);
                var isImage = IsImageFile(fileName);

                return new JsonResult(new
                {
                    success = true,
                    fileUrl = $"/uploads/{fileName}",
                    fileName = fileName,
                    fileSize = fileInfo.Length,
                    fileType = isImage ? "image" : "file"
                });
            }

            return new JsonResult(new { success = true, chunkIndex });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error processing file chunk upload");
            return StatusCode(500, $"Internal server error: {ex.Message}");
        }
    }

    public IActionResult OnGetDownloadFile(string fileName)
    {
        var filePath = Path.Combine(_environment.WebRootPath, "uploads", fileName);
        if (!System.IO.File.Exists(filePath))
        {
            return NotFound("File not found on server.");
        }

        var provider = new Microsoft.AspNetCore.StaticFiles.FileExtensionContentTypeProvider();
        if (!provider.TryGetContentType(filePath, out var contentType))
        {
            contentType = "application/octet-stream";
        }

        return new PhysicalFileResult(filePath, contentType)
        {
            FileDownloadName = fileName,
            EnableRangeProcessing = true
        };
    }

    private bool IsImageFile(string fileName)
    {
        var ext = Path.GetExtension(fileName).ToLowerInvariant();
        return ext == ".png" || ext == ".jpg" || ext == ".jpeg" || ext == ".gif" || ext == ".webp" || ext == ".bmp";
    }
}
