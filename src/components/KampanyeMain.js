import React, { useState } from 'react';
import PromoTiktok from './PromoTiktok';
import PromoShopee from './PromoShopee';

function KampanyeMain() {
  const [platform, setPlatform] = useState('tiktok');
  
  return (
    <div>
        <div style={{ 
          display: 'inline-flex',
          background: 'var(--bg-glass)',
          border: '1px solid var(--border-medium)',
          borderRadius: '0.75rem',
          padding: '0.375rem',
          marginBottom: '1.5rem',
          gap: '0.25rem',
          boxShadow: '0 2px 10px rgba(0,0,0,0.03)'
        }}>
          <button 
             onClick={() => setPlatform('tiktok')}
             style={{ 
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                padding: '0.5rem 2.5rem', 
                borderRadius: '0.5rem', 
                border: 'none', 
                background: platform === 'tiktok' ? 'var(--bg-primary)' : 'transparent', 
                color: platform === 'tiktok' ? '#6c5ce7' : 'var(--text-secondary)', 
                cursor: 'pointer', 
                fontWeight: 700,
                fontSize: '0.875rem',
                letterSpacing: '0.01em',
                transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                boxShadow: platform === 'tiktok' ? '0 2px 8px rgba(0,0,0,0.06)' : 'none',
             }}>
             TikTok
          </button>
          <button 
             onClick={() => setPlatform('shopee')}
             style={{ 
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                padding: '0.5rem 2.5rem', 
                borderRadius: '0.5rem', 
                border: 'none', 
                background: platform === 'shopee' ? 'var(--bg-primary)' : 'transparent', 
                color: platform === 'shopee' ? '#ee4d2d' : 'var(--text-secondary)', 
                cursor: 'pointer', 
                fontWeight: 700,
                fontSize: '0.875rem',
                letterSpacing: '0.01em',
                transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                boxShadow: platform === 'shopee' ? '0 2px 8px rgba(0,0,0,0.06)' : 'none',
             }}>
             Shopee
          </button>
        </div>
       
       <div>
           {platform === 'tiktok' ? <PromoTiktok /> : <PromoShopee />}
       </div>
    </div>
  )
}

export default KampanyeMain;
