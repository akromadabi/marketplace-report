import React, { useState } from 'react';
import PromoTiktok from './PromoTiktok';
import PromoShopee from './PromoShopee';

function KampanyeMain() {
  const [platform, setPlatform] = useState('tiktok');
  
  return (
    <div>
        <div style={{ 
          display: 'inline-flex',
          background: 'var(--bg-card)',
          border: '1px solid var(--border-color)',
          borderRadius: 'var(--radius-lg)',
          padding: '0.25rem',
          marginBottom: '0.65rem',
          gap: '0.25rem',
          boxShadow: 'var(--shadow-xs)'
        }}>
          <button 
             onClick={() => setPlatform('tiktok')}
             style={{ 
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                padding: '0.4rem 1.75rem', 
                borderRadius: 'var(--radius-md)', 
                border: 'none', 
                background: platform === 'tiktok' ? 'linear-gradient(135deg, #7c3aed 0%, #4f46e5 100%)' : 'transparent', 
                color: platform === 'tiktok' ? '#ffffff' : 'var(--text-secondary)', 
                cursor: 'pointer', 
                fontWeight: 700,
                fontSize: '0.8125rem',
                letterSpacing: '0.01em',
                transition: 'all 0.2s ease',
                boxShadow: platform === 'tiktok' ? '0 2px 6px rgba(124, 58, 237, 0.25)' : 'none',
             }}>
             TikTok
          </button>
          <button 
             onClick={() => setPlatform('shopee')}
             style={{ 
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                padding: '0.4rem 1.75rem', 
                borderRadius: 'var(--radius-md)', 
                border: 'none', 
                background: platform === 'shopee' ? 'linear-gradient(135deg, #ea580c 0%, #c2410c 100%)' : 'transparent', 
                color: platform === 'shopee' ? '#ffffff' : 'var(--text-secondary)', 
                cursor: 'pointer', 
                fontWeight: 700,
                fontSize: '0.8125rem',
                letterSpacing: '0.01em',
                transition: 'all 0.2s ease',
                boxShadow: platform === 'shopee' ? '0 2px 6px rgba(234, 88, 12, 0.25)' : 'none',
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
