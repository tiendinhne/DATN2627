# Cấu hình Môi trường Phát triển (Development Environment)

## Hướng dẫn sử dụng Mô hình (Model Instructions)
- Luôn ưu tiên chạy các tác vụ phân tích cấu trúc phức tạp bằng mô hình: `claude-sonnet-5`
- Đối với các tác vụ viết code boilerplate nhanh hoặc sửa lỗi nhỏ, hãy hạ cấp xuống mô hình: `claude-haiku-4-5` để tiết kiệm chi phí.
- Nếu gặp bài toán thuật toán cực khó hoặc lỗi lặp lại liên tục, hãy yêu cầu hệ thống kích hoạt mô hình: `claude-opus-5`.

## Chỉ thị Thực thi lệnh Hệ thống
Trước khi bắt đầu sinh hoặc sửa đổi code, hãy chủ động kiểm tra mô hình hiện tại bằng cách thực thi lệnh:
`/model <tên_model_phù_hợp>`

## chi tiết document về các phần nằm ở docs/
