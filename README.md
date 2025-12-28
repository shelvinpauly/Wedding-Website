# Wedding Website

A beautiful, responsive wedding website for Shelvin & Nancy's special day on April 17, 2026.

## 🌟 Overview

This static website serves as the central hub for wedding information, including the schedule, wedding party details, registry, RSVP functionality, and frequently asked questions. Built with modern web technologies for a seamless user experience across all devices.

## 📅 Wedding Details

- **Date**: April 17, 2026
- **Location**: Somerset, NJ
- **Time**: 4:00 PM (local time)
- **RSVP Deadline**: March 15, 2026

## 🛠️ Technology Stack

- **HTML5**: Semantic markup for accessibility and SEO
- **CSS3**: Custom styling with responsive design
- **Vanilla JavaScript**: Interactive features including countdown timer and RSVP form
- **GitHub Pages**: Hosting with custom domain (shelvinandnancy.com)

## 📁 Project Structure

```
├── index.html          # Homepage with hero section and navigation
├── schedule.html       # Wedding ceremony and reception details
├── wedding-party.html  # Bridal party information
├── registry.html       # Gift registry links
├── rsvp.html          # RSVP form with validation
├── faqs.html          # Frequently asked questions
├── css/
│   └── style.css      # Main stylesheet
├── js/
│   └── main.js        # JavaScript functionality
├── images/            # Wedding photos and assets
├── CNAME              # Custom domain configuration
├── LICENSE            # Apache License 2.0
└── README.md          # This file
```

## 🚀 Features

- **Responsive Design**: Optimized for desktop, tablet, and mobile devices
- **Interactive Countdown**: Live countdown timer to the wedding date
- **RSVP System**: Form-based RSVP with email collection
- **Navigation**: Clean, intuitive site navigation
- **Accessibility**: Semantic HTML and proper ARIA labels
- **Performance**: Lightweight, fast-loading static site

## 🏃‍♂️ Getting Started

### Prerequisites

- A modern web browser
- Text editor (VS Code recommended)
- Git for version control

### Local Development

1. **Clone the repository**
   ```bash
   git clone https://github.com/yourusername/wedding-website.git
   cd wedding-website
   ```

2. **Open in browser**
   - Simply open `index.html` in your web browser
   - Or use a local server for better development experience:
     ```bash
     # Using Python
     python -m http.server 8000

     # Using Node.js
     npx serve .

     # Using PHP
     php -S localhost:8000
     ```

3. **Make changes**
   - Edit HTML files for content updates
   - Modify `css/style.css` for styling changes
   - Update `js/main.js` for interactive features

### Deployment

The site is configured for GitHub Pages deployment:

1. Push changes to the main branch
2. GitHub Pages will automatically deploy updates
3. Custom domain configured via CNAME file

## 📝 Customization

### Updating Wedding Details

- **Date/Time**: Update in `js/main.js` (weddingDate variable)
- **Location**: Edit in relevant HTML files
- **RSVP Deadline**: Change in `rsvp.html`

### Styling

- Main styles are in `css/style.css`
- Color scheme and typography can be customized
- Responsive breakpoints are defined for mobile optimization

### Content

- Update text content directly in HTML files
- Replace placeholder images in the `images/` folder
- Add new pages by following the existing HTML structure

## 🤝 Contributing

This is a personal wedding website, but if you'd like to suggest improvements:

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

## 📄 License

This project is licensed under the Apache License 2.0 - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- Built with love for Shelvin & Nancy
- Inspired by modern wedding website designs
- Thanks to the web development community for best practices

---

*"And now these three remain: faith, hope and love. But the greatest of these is love."*  
— 1 Corinthians 13:13