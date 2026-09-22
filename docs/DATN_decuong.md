# **ĐỀ CƯƠNG ĐỒ ÁN TỐT NGHIỆP**

## **1\. Tên đề tài**

### **Tên tiếng Việt**

**Hệ thống học nhóm trực tuyến dựa trên WebRTC, tích hợp bảng vẽ cộng tác thông minh**

### **Tên tiếng Anh**

**A WebRTC-Based Online Group Learning System with an Intelligent Collaborative Whiteboard**

# **2\. Lý do chọn đề tài**

Sự phát triển của công nghệ thông tin và hình thức học tập trực tuyến làm gia tăng nhu cầu tổ chức các hoạt động học nhóm và trao đổi từ xa. Trong quá trình thực hiện bài tập, đồ án hoặc thảo luận chuyên môn, các thành viên thường có nhu cầu giao tiếp trực tiếp, chia sẻ màn hình, trao đổi nội dung và cùng xây dựng các sơ đồ hoặc ý tưởng trực quan.

Tuy nhiên, các hoạt động trên thường phải sử dụng nhiều công cụ khác nhau cho từng mục đích như hội nghị trực tuyến, nhắn tin, bảng vẽ và các công cụ hỗ trợ trí tuệ nhân tạo. Việc sử dụng nhiều nền tảng riêng biệt làm phân tán quá trình làm việc, đồng thời gây khó khăn trong việc quản lý và lưu trữ nội dung được tạo ra trong quá trình học nhóm.

WebRTC cung cấp khả năng truyền thông âm thanh, video và chia sẻ màn hình theo thời gian thực trực tiếp trên nền tảng web. Bên cạnh đó, các công nghệ đồng bộ dữ liệu thời gian thực và bảng vẽ cộng tác cho phép nhiều người dùng cùng làm việc trên một không gian trực quan. Sự phát triển của Generative AI cũng tạo điều kiện để hỗ trợ người dùng chuyển đổi yêu cầu bằng ngôn ngữ tự nhiên thành các nội dung có cấu trúc.

Từ những vấn đề trên, đề tài được thực hiện nhằm nghiên cứu và xây dựng một hệ thống học nhóm trực tuyến tích hợp giao tiếp đa phương tiện, bảng vẽ cộng tác và trợ lý AI trong cùng một không gian làm việc. Hệ thống hướng đến việc hỗ trợ người dùng trao đổi, trình bày và phát triển ý tưởng một cách trực quan và liên tục trong quá trình học tập.

# **3\. Mục tiêu đề tài**

## **3.1. Mục tiêu tổng quát**

Nghiên cứu và xây dựng một hệ thống học nhóm trực tuyến hoạt động trên nền tảng web, ứng dụng WebRTC để hỗ trợ giao tiếp đa phương tiện theo thời gian thực và tích hợp bảng vẽ cộng tác thông minh nhằm hỗ trợ người dùng giao tiếp, trao đổi và trực quan hóa ý tưởng trong cùng một môi trường làm việc.

Điểm chính là khả năng chịu tải khi nhiều người cùng tham gia trong webrtc.

## **3.2. Mục tiêu cụ thể**

Đề tài tập trung thực hiện các mục tiêu sau:

* Xây dựng chức năng đăng ký, đăng nhập và quản lý tài khoản người dùng.  
* Xây dựng chức năng tạo, tham gia và quản lý phòng học nhóm.  
* Hỗ trợ giao tiếp bằng âm thanh, video và chia sẻ màn hình theo thời gian thực.  
* Xây dựng chức năng trao đổi tin nhắn trong phòng.  
* Tích hợp bảng vẽ trực tuyến cho phép nhiều người dùng cùng thao tác.  
* Đồng bộ các thao tác trên bảng vẽ theo thời gian thực.  
* Hiển thị thành viên và trạng thái hoạt động trong phòng.  
* Tích hợp trợ lý AI hỗ trợ tạo và tổ chức nội dung trực quan.  
* Lưu trữ nội dung bảng vẽ và các dữ liệu cần thiết của phòng học.  
* Đóng gói và triển khai hệ thống bằng công nghệ container.  
* Kiểm thử và đánh giá khả năng hoạt động của hệ thống.

# **4\. Đối tượng và phạm vi thực hiện**

## **4.1. Đối tượng sử dụng**

Hệ thống hướng đến sinh viên, giảng viên và các nhóm học tập hoặc làm việc từ xa có nhu cầu tổ chức các buổi học nhóm, thảo luận, trình bày và trực quan hóa ý tưởng.

## **4.2. Phạm vi thực hiện**

Đề tài tập trung xây dựng một ứng dụng web cho phép người dùng tạo và tham gia các phòng học nhóm trực tuyến. Trong mỗi phòng, người dùng có thể giao tiếp bằng âm thanh, video, chia sẻ màn hình, trao đổi tin nhắn và cùng làm việc trên bảng vẽ.

Bảng vẽ hỗ trợ các thao tác cơ bản như vẽ, tạo hình, thêm văn bản, tạo đường nối, di chuyển và chỉnh sửa đối tượng. Các thao tác của người dùng được đồng bộ đến các thành viên khác trong phòng theo thời gian thực.

Trợ lý AI được tích hợp nhằm hỗ trợ một số tác vụ liên quan trực tiếp đến bảng vẽ như tạo sơ đồ, mindmap, flowchart hoặc tổ chức nội dung từ yêu cầu bằng ngôn ngữ tự nhiên.

Đề tài không tập trung phát triển ứng dụng mobile native, không huấn luyện mô hình AI riêng và không hướng đến việc xây dựng hệ thống hội nghị trực tuyến quy mô lớn tương đương các nền tảng thương mại. Hệ thống cũng không nhằm thay thế các phần mềm thiết kế đồ họa chuyên nghiệp.

# **5\. Nội dung thực hiện**

## **5.1. Khảo sát và phân tích yêu cầu**

Khảo sát nhu cầu học nhóm trực tuyến và các giải pháp hiện có trên thị trường. Phân tích những chức năng cần thiết đối với một hệ thống học nhóm có khả năng giao tiếp và cộng tác trực quan.

Từ kết quả khảo sát, xác định yêu cầu chức năng, yêu cầu phi chức năng, đối tượng sử dụng và phạm vi của hệ thống.

## **5.2. Nghiên cứu công nghệ WebRTC và truyền thông thời gian thực**

Nghiên cứu nguyên lý hoạt động của WebRTC và các thành phần liên quan đến truyền thông đa phương tiện trên nền tảng web.

Nghiên cứu kiến trúc SFU và lựa chọn giải pháp phù hợp để hỗ trợ nhiều người dùng giao tiếp bằng âm thanh, video và chia sẻ màn hình trong cùng một phòng.

## **5.3. Phân tích và thiết kế hệ thống**

Phân tích các yêu cầu và xây dựng kiến trúc tổng thể của hệ thống. Thiết kế các thành phần Frontend, Backend, cơ chế giao tiếp thời gian thực, Media Server, cơ sở dữ liệu và dịch vụ AI.

Thiết kế các mô hình Use Case, Activity Diagram, Sequence Diagram, Component Diagram, Deployment Diagram và mô hình dữ liệu của hệ thống.

## **5.4. Xây dựng chức năng quản lý tài khoản và phòng học**

Xây dựng chức năng đăng ký, đăng nhập và quản lý tài khoản người dùng. Người dùng sau khi đăng nhập có thể tạo phòng, tham gia phòng thông qua mã hoặc đường dẫn và quản lý các hoạt động trong phòng theo quyền được cấp.

Chủ phòng có quyền quản lý thành viên và kết thúc phòng, trong khi thành viên có thể tham gia các hoạt động cộng tác theo quyền được cấp.

## **5.5. Xây dựng chức năng giao tiếp đa phương tiện**

Tích hợp WebRTC và SFU để hỗ trợ truyền tải âm thanh, video và chia sẻ màn hình trong phòng học. Hệ thống cho phép người dùng kiểm soát camera và microphone, đồng thời hiển thị thông tin và trạng thái của các thành viên.

## **5.6. Xây dựng chức năng cộng tác trên bảng vẽ**

Tích hợp thư viện bảng vẽ phù hợp để cung cấp một không gian làm việc trực quan cho các thành viên.

Người dùng có thể cùng tạo, chỉnh sửa, di chuyển và xóa các đối tượng trên bảng vẽ. Các thay đổi được truyền và đồng bộ theo thời gian thực để các thành viên trong phòng cùng quan sát và cộng tác.

## **5.7. Xây dựng chức năng trợ lý AI**

Tích hợp dịch vụ Generative AI để hỗ trợ người dùng tạo nội dung trực quan từ yêu cầu bằng ngôn ngữ tự nhiên.

Hệ thống xử lý kết quả do AI tạo ra và chuyển đổi thành nội dung phù hợp với bảng vẽ. Người dùng có thể tiếp tục chỉnh sửa nội dung được tạo bởi AI ngay trên bảng vẽ.

## **5.8. Xây dựng chức năng lưu trữ dữ liệu**

Thiết kế cơ sở dữ liệu để lưu trữ thông tin tài khoản, phòng học, thành viên, nội dung trao đổi và dữ liệu bảng vẽ.

Hệ thống lưu trạng thái bảng vẽ nhằm hỗ trợ việc xem lại hoặc khôi phục nội dung sau khi phiên học kết thúc.

## **5.9. Kiểm thử và đánh giá**

Thực hiện kiểm thử các chức năng chính của hệ thống và kiểm tra khả năng hoạt động của các thành phần thời gian thực.

Đặc biệt đánh giá khả năng đồng bộ bảng vẽ khi có nhiều người dùng cùng thao tác, khả năng kết nối và truyền tải âm thanh, video, khả năng xử lý khi người dùng tham gia hoặc rời phòng và khả năng hoạt động của trợ lý AI.

## **5.10. Đóng gói và triển khai**

Đóng gói các thành phần của hệ thống bằng Docker và sử dụng Docker Compose để quản lý môi trường triển khai.

NGINX được sử dụng làm Reverse Proxy nhằm quản lý kết nối giữa người dùng và các dịch vụ của hệ thống. Hệ thống được triển khai trên môi trường máy chủ thử nghiệm để phục vụ kiểm tra và đánh giá.

# **6\. Luồng hoạt động của hệ thống**

## **6.1. Luồng hoạt động tổng quát**

Người dùng bắt đầu bằng việc đăng ký hoặc đăng nhập vào hệ thống. Sau khi xác thực thành công, người dùng được chuyển đến giao diện chính và có thể lựa chọn tạo một phòng học nhóm mới hoặc tham gia một phòng đã tồn tại thông qua mã hoặc đường dẫn.

Một phòng sẽ có thể mở nhiều buổi meeting khác nhau, mỗi meeting có một board riêng  đến khi host giải tán phòng. Lịch sử meeting sẽ được lưu lại trong phòng. Sau khi tham gia meeting, hệ thống kiểm tra quyền truy cập và thiết lập các kết nối cần thiết. WebRTC được sử dụng để thiết lập giao tiếp âm thanh, video và chia sẻ màn hình, trong khi WebSocket được sử dụng để đồng bộ tin nhắn, trạng thái thành viên và các thao tác trên bảng vẽ.

Trong quá trình học nhóm, các thành viên có thể trao đổi bằng âm thanh, video hoặc tin nhắn và cùng làm việc trên bảng vẽ. Khi một thành viên thực hiện thay đổi trên bảng vẽ, dữ liệu thay đổi được gửi đến máy chủ và phân phối đến các thành viên khác để cập nhật trạng thái tương ứng.

Khi cần hỗ trợ, người dùng có thể gửi yêu cầu cho trợ lý AI. Hệ thống chuyển yêu cầu đến dịch vụ AI, xử lý kết quả trả về và chuyển đổi thành nội dung trực quan trên bảng vẽ. Nội dung này tiếp tục được đồng bộ cho các thành viên trong phòng.

Trong quá trình hoạt động, hệ thống lưu trữ các dữ liệu cần thiết. Khi buổi học kết thúc, chủ phòng thực hiện kết thúc phiên làm việc. Hệ thống lưu trạng thái cuối cùng của bảng vẽ, đóng các kết nối thời gian thực và cập nhật trạng thái của phòng.

**Luồng tổng quát:**

**Đăng nhập → Tạo/Tham gia phòng \-\>join meeting → Thiết lập kết nối → Giao tiếp và học nhóm → Cộng tác trên bảng vẽ → Sử dụng AI → Lưu dữ liệu → Kết thúc meeting ( có thể out room hoặc host giải tán).**

## **6.2. Luồng tạo và tham gia phòng**

Người dùng sau khi đăng nhập lựa chọn tạo phòng hoặc tham gia phòng. Nếu tạo phòng, người dùng nhập thông tin cần thiết và hệ thống tạo phòng mới cùng mã hoặc đường dẫn tham gia. Nếu tham gia phòng, người dùng cung cấp mã hoặc đường dẫn, hệ thống kiểm tra phòng và quyền truy cập. Sau khi hợp lệ, người dùng được thêm vào phòng và có thể bắt đầu các hoạt động học nhóm.

## **6.3. Luồng giao tiếp thời gian thực**

Khi người dùng tham gia phòng, hệ thống thiết lập kết nối WebRTC với Media Server theo kiến trúc SFU. Các luồng âm thanh, video hoặc màn hình của người dùng được truyền đến SFU và phân phối đến các thành viên khác. Người dùng có thể bật, tắt camera, microphone hoặc chia sẻ màn hình trong suốt phiên học.

Tin nhắn cuộc họp đổ thẳng vào Chat Room 

Khi có cuộc họp diễn ra, giao diện hiển thị một khung chat riêng trong màn hình video. Tuy nhiên, dưới Database, tất cả tin nhắn này vẫn được lưu vào luồng chat chung của Room.

\* Cách hoạt động:

\* Khi người dùng chat trong cuộc họp, hệ thống tự động gán thêm trường meeting\_id vào tin nhắn đó.

   \* Ở ngoài Room, tin nhắn này vẫn xuất hiện trong luồng chat chính, kèm theo một biểu tượng nhỏ (ví dụ: \[Trong cuộc họp: "Họp Tiến Độ"\]).

\* Ưu điểm: Người không tham gia cuộc họp vẫn đọc được nội dung chat. Khi cuộc họp kết thúc, toàn bộ lịch sử chat không bị mất hay bị cô lập, người dùng chỉ cần cuộn luồng chat Room là thấy lại.

## **6.4. Luồng cộng tác bảng vẽ**

Khi một thành viên thực hiện thao tác trên bảng vẽ, ứng dụng ghi nhận thay đổi và gửi thông tin đến máy chủ thông qua WebSocket. Máy chủ xử lý và phân phối thay đổi đến các thành viên còn lại. Các máy khách nhận được thông tin sẽ cập nhật bảng vẽ tương ứng, giúp các thành viên duy trì cùng một trạng thái nội dung.

## **6.5. Luồng xử lý AI**

Người dùng nhập yêu cầu vào trợ lý AI. Hệ thống gửi yêu cầu đến Backend, sau đó chuyển đến dịch vụ Generative AI. Kết quả trả về được xử lý và chuyển đổi thành các đối tượng phù hợp với bảng vẽ. Sau khi được kiểm tra, nội dung được tạo trên bảng vẽ và đồng bộ đến các thành viên khác trong phòng.

## **6.6. Luồng kết thúc phiên học**

Khi chủ phòng kết thúc phiên học, hệ thống lưu trạng thái cuối cùng của bảng vẽ và các dữ liệu cần thiết. Sau đó, các kết nối WebRTC và WebSocket được đóng, phòng chuyển sang trạng thái kết thúc và các thành viên nhận được thông báo về việc kết thúc phiên học.

# **7\. Kiến trúc hệ thống dự kiến**

Hệ thống được xây dựng theo kiến trúc Client–Server, trong đó Frontend cung cấp giao diện và xử lý tương tác với người dùng, Backend xử lý nghiệp vụ và quản lý dữ liệu.

WebRTC kết hợp với SFU đảm nhiệm việc truyền tải âm thanh, video và chia sẻ màn hình. WebSocket đảm nhiệm việc trao đổi dữ liệu thời gian thực như tin nhắn, trạng thái thành viên và thao tác bảng vẽ.

Redis được sử dụng để hỗ trợ các dữ liệu trạng thái cần truy cập nhanh và cơ chế Pub/Sub giữa các thành phần. Cơ sở dữ liệu được sử dụng để lưu trữ dữ liệu lâu dài. Dịch vụ AI được tích hợp thông qua API.

Kiến trúc triển khai dự kiến gồm Frontend, Backend, Database, Redis, Media Server và NGINX Reverse Proxy, được đóng gói và quản lý bằng Docker.

**8\. Định hướng công nghệ**

**Frontend:** Sử dụng NextJs, shadcn và Tailwind CSS để xây dựng giao diện web và các thành phần tương tác của hệ thống.

**Backend:** Sử dụng Node.js với NestJS để xây dựng RESTful API, xử lý nghiệp vụ, xác thực người dùng, quản lý phòng học và tích hợp các dịch vụ bên ngoài.

**Cơ sở dữ liệu:** Sử dụng MongoDB kết hợp mongoose để quản lý dữ liệu người dùng, phòng học, thành viên, tin nhắn và thông tin bảng vẽ.

**Truyền thông đa phương tiện:** Sử dụng WebRTC thông qua nền tảng LiveKit nhằm hỗ trợ truyền tải âm thanh, video và chia sẻ màn hình trong phòng học. Việc sử dụng giải pháp SFU có sẵn giúp giảm độ phức tạp trong quá trình triển khai hệ thống WebRTC.

**Giao tiếp thời gian thực:** Sử dụng Socket.IO để xử lý các hoạt động cần đồng bộ theo thời gian thực như tin nhắn, trạng thái thành viên và các sự kiện cộng tác.

**Bảng vẽ cộng tác:** Sử dụng excalidraw để cung cấp các chức năng bảng vẽ cơ bản và tập trung phát triển cơ chế tích hợp, đồng bộ và cộng tác phù hợp với yêu cầu của đề tài.

**Trí tuệ nhân tạo:** Tích hợp Generative AI API để xây dựng trợ lý AI hỗ trợ người dùng tạo sơ đồ, mindmap, flowchart và tổ chức nội dung trực quan từ yêu cầu bằng ngôn ngữ tự nhiên.

**Cache và đồng bộ:** Redis được sử dụng khi cần thiết để hỗ trợ lưu trữ trạng thái tạm thời, Pub/Sub và khả năng mở rộng các thành phần xử lý thời gian thực.

**Hạ tầng và triển khai:** Hệ thống được đóng gói bằng Docker và Docker Compose, triển khai trên môi trường máy chủ đám mây dựa trên kiến thức về điện toán đám mây đã được học. Một Cloud VM/VPS được sử dụng để triển khai các thành phần của hệ thống. NGINX được sử dụng làm Reverse Proxy và xử lý kết nối HTTPS. Hệ thống được cấu hình mạng và bảo mật phù hợp để hỗ trợ các dịch vụ HTTP, WebSocket và WebRTC. GitHub Actions có thể được sử dụng để xây dựng quy trình CI/CD cơ bản, bao gồm kiểm thử, xây dựng Docker Image và triển khai ứng dụng lên máy chủ. 

Việc lựa chọn công nghệ có thể được điều chỉnh trong giai đoạn thử nghiệm kỹ thuật nếu phát sinh vấn đề về khả năng tích hợp hoặc tính khả thi. Tuy nhiên, nhóm ưu tiên sử dụng các giải pháp có sẵn đối với những thành phần hạ tầng phức tạp như Media Server và Whiteboard, tập trung nguồn lực vào việc phát triển các chức năng nghiệp vụ, cơ chế cộng tác và tích hợp trợ lý AI của hệ thống.

# **9\. Phương pháp thực hiện**

Đề tài được thực hiện theo quy trình gồm các giai đoạn: khảo sát và phân tích yêu cầu, nghiên cứu công nghệ, thử nghiệm giải pháp, thiết kế hệ thống, phát triển, tích hợp, kiểm thử, triển khai và đánh giá.

Trong giai đoạn nghiên cứu công nghệ, nhóm ưu tiên thực hiện các thử nghiệm nhỏ đối với WebRTC, SFU, WebSocket, thư viện bảng vẽ và Generative AI nhằm đánh giá tính khả thi trước khi lựa chọn giải pháp chính thức.

Sau khi hoàn thành phân tích và thiết kế, các chức năng được phát triển theo từng module. Các thành phần sau đó được tích hợp thành một hệ thống thống nhất và tiến hành kiểm thử trên môi trường thử nghiệm.

# **10\. Kết quả dự kiến**

Sau khi hoàn thành, đề tài dự kiến đạt được một hệ thống học nhóm trực tuyến hoạt động trên nền tảng web với các chức năng quản lý tài khoản, phòng học, giao tiếp âm thanh và video, chia sẻ màn hình, nhắn tin và cộng tác trên bảng vẽ.

Hệ thống có khả năng đồng bộ nội dung bảng vẽ giữa nhiều người dùng trong cùng một phòng và tích hợp trợ lý AI để hỗ trợ tạo, tổ chức nội dung trực quan từ yêu cầu bằng ngôn ngữ tự nhiên.

Hệ thống được đóng gói và triển khai bằng Docker, có cơ sở dữ liệu phục vụ lưu trữ thông tin người dùng, phòng học và nội dung cộng tác.

Các sản phẩm đi kèm bao gồm mã nguồn hệ thống, cơ sở dữ liệu, cấu hình triển khai, tài liệu phân tích và thiết kế, bộ ca kiểm thử, kết quả kiểm thử, tài liệu hướng dẫn sử dụng và báo cáo đồ án.

# **11\. Tài liệu tham khảo dự kiến**

Tài liệu tham khảo tập trung vào các nhóm nội dung:

* Tài liệu tiêu chuẩn và đặc tả của WebRTC.  
* Tài liệu về kiến trúc SFU và truyền thông thời gian thực.  
* Tài liệu về WebSocket và các giao thức giao tiếp thời gian thực.  
* Tài liệu kỹ thuật của thư viện bảng vẽ được lựa chọn.  
* Tài liệu về Generative AI và API của nhà cung cấp được lựa chọn.  
* Tài liệu về React, Node.js và NestJS.  
* Tài liệu PostgreSQL/MongoDB và Redis.  
* Tài liệu Docker, Docker Compose và NGINX.

